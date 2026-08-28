import axios from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger.js';
import { getConfig } from './configService.js';
import prisma from '../config/prisma.js';
import { listNotificationLogs, writeNotificationLog } from './notificationLogService.js';
import { applyPaidOrderInventoryMovements } from './orderInventoryService.js';
import { notifyStaffOrderPaid } from './staffNotificationService.js';
import { getProductAvailableStock, hasProductAvailability } from '../utils/productAvailability.js';

const MELI_API_BASE_URL = 'https://api.mercadolibre.com';
const MELI_CHANNEL = 'MERCADOLIBRE';
const MELI_ORDER_PREFIX = 'MELI';
const nullableJson = (value) => value == null ? Prisma.DbNull : value;

const ORDER_INCLUDE = {
  user: true,
  orderItems: {
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          productType: true,
          costPrice: true,
          price: true,
          countInStock: true,
          supplierStock: true,
          supplierStockUnlimited: true,
          supplierLeadTimeMinutes: true,
        },
      },
    },
  },
  externalOrders: true,
  statusHistory: { orderBy: { date: 'asc' } },
};

const assertMeliConfig = () => {
  const config = getConfig();
  const missing = [
    ['MERCADOLIBRE_APP_ID', config.MERCADOLIBRE_APP_ID],
    ['MERCADOLIBRE_CLIENT_SECRET', config.MERCADOLIBRE_CLIENT_SECRET],
    ['MERCADOLIBRE_REDIRECT_URI', config.MERCADOLIBRE_REDIRECT_URI],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Falta configurar Mercado Libre: ${missing.map(([key]) => key).join(', ')}`);
  }

  return config;
};

const toExpiresAt = (expiresIn) => {
  if (!expiresIn) return null;
  return new Date(Date.now() + Number(expiresIn) * 1000);
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const cleanMeliOrderId = (value = '') => {
  const text = String(value || '').trim();
  const match = text.match(/orders\/([^/?#]+)/i);
  if (match?.[1]) return match[1];
  return text.replace(/^\/+/, '').split('/').filter(Boolean).pop() || text;
};

const uniqueTruthy = (values = []) => [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];

const isPaidMeliOrder = (order = {}) => {
  const status = String(order.status || '').toLowerCase();
  const statusDetail = String(order.status_detail || '').toLowerCase();
  const payments = Array.isArray(order.payments) ? order.payments : [];
  return status === 'paid'
    || statusDetail.includes('paid')
    || payments.some((payment) => String(payment.status || '').toLowerCase() === 'approved')
    || toNumber(order.paid_amount) > 0;
};

const mapMeliStatusToOrderStatus = (order = {}) => {
  const status = String(order.status || '').toLowerCase();
  const shippingStatus = String(order.shipping?.status || '').toLowerCase();

  if (status.includes('cancel')) return 'CANCELLED';
  if (shippingStatus === 'delivered') return 'DELIVERED';
  if (shippingStatus === 'shipped') return 'SHIPPED';
  if (isPaidMeliOrder(order)) return 'PENDING_FULFILLMENT';
  return 'PENDING_PAYMENT';
};

const getMeliCustomerName = (order = {}) => {
  const buyer = order.buyer || {};
  return [
    buyer.first_name,
    buyer.last_name,
  ].filter(Boolean).join(' ') || buyer.nickname || buyer.email || `Comprador Meli ${buyer.id || ''}`.trim();
};

const getMeliCustomerEmail = (order = {}, externalOrderId = '') => {
  const buyer = order.buyer || {};
  return buyer.email || `meli-${buyer.id || externalOrderId}@clientes.mercadolibre.tecnotitlan.local`;
};

const getMeliPhone = (order = {}) => {
  const candidates = [
    order.buyer?.phone?.number,
    [order.buyer?.phone?.area_code, order.buyer?.phone?.number].filter(Boolean).join(''),
    order.shipping?.receiver_address?.receiver_phone,
    order.shipping?.receiver_address?.phone,
  ];
  return uniqueTruthy(candidates)[0] || null;
};

const buildMeliShippingAddress = (order = {}) => {
  const address = order.shipping?.destination?.shipping_address
    || order.shipping?.receiver_address
    || {};
  return {
    source: 'mercadolibre',
    receiverName: order.shipping?.destination?.receiver_name
      || address.receiver_name
      || getMeliCustomerName(order),
    phone: order.shipping?.destination?.receiver_phone || getMeliPhone(order),
    street: address.street_name || '',
    number: address.street_number || '',
    neighborhood: address.neighborhood?.name || address.neighborhood || '',
    city: address.city?.name || address.city || '',
    state: address.state?.name || address.state || '',
    zipCode: address.zip_code || '',
    country: address.country?.name || 'Mexico',
    raw: address,
  };
};

const compactMeliAddress = (address = {}) => {
  const street = [address.street_name, address.street_number].filter(Boolean).join(' ');
  return {
    name: address.name || address.receiver_name || null,
    addressLine: address.address_line || street || null,
    neighborhood: address.neighborhood?.name || address.neighborhood || null,
    city: address.city?.name || address.city || null,
    state: address.state?.name || address.state || null,
    zipCode: address.zip_code || null,
  };
};

const getMeliDispatchDetails = (shipping = {}) => {
  const logisticType = shipping.logistic?.type || shipping.logistic_type || null;
  const origin = shipping.origin || {};
  const originAddress = shipping.sender_address || origin.shipping_address || {};
  const detailsUrl = shipping.id
    ? `https://www.mercadolibre.com.mx/ventas/${shipping.id}/detalle`
    : null;
  const definitions = {
    xd_drop_off: {
      mode: 'drop_off_place',
      title: 'Entrega en punto Mercado Libre',
      instruction: 'Lleva el paquete etiquetado al punto Places asignado. Consulta el punto exacto y el horario en el detalle de la venta.',
    },
    drop_off: {
      mode: 'drop_off_carrier',
      title: 'Entrega en paqueteria',
      instruction: 'Lleva el paquete etiquetado a la sucursal o punto de entrega que Mercado Libre indique para esta venta.',
    },
    cross_docking: {
      mode: 'seller_pickup',
      title: 'Recoleccion en domicilio',
      instruction: 'Mercado Libre o su transportista recolectara el paquete en el domicilio de origen configurado.',
    },
    fulfillment: {
      mode: 'fulfillment',
      title: 'Mercado Libre Full',
      instruction: 'Mercado Libre prepara y despacha el producto desde su centro de fulfillment.',
    },
    self_service: {
      mode: 'self_service',
      title: 'Entrega Flex',
      instruction: 'Despacha el pedido con la logistica Flex configurada en la cuenta.',
    },
  };
  const definition = definitions[logisticType] || {
    mode: 'meli_shipping',
    title: 'Despacho por Mercado Libre',
    instruction: 'Consulta el detalle de la venta para confirmar como y donde debes despachar el paquete.',
  };

  return {
    ...definition,
    logisticType,
    originNode: origin.node || null,
    originAddress: Object.values(originAddress).some(Boolean)
      ? compactMeliAddress(originAddress)
      : null,
    detailsUrl,
  };
};

const buildMeliShippingInfo = (order = {}) => {
  const shipping = order.shipping || {};
  const logistic = shipping.logistic || {};
  const method = shipping.lead_time?.shipping_method || {};
  const printable = shipping.status === 'ready_to_ship'
    && ['ready_to_print', 'printed'].includes(String(shipping.substatus || ''));
  return {
    provider: 'mercadolibre',
    shippingId: shipping.id || null,
    status: shipping.status || null,
    substatus: shipping.substatus || null,
    trackingNumber: shipping.tracking_number || null,
    carrier: shipping.tracking_method || method.name || 'Mercado Envios',
    trackingUrl: shipping.tracking_number
      ? `https://www.mercadolibre.com.mx/ventas/${shipping.id}/detalle`
      : null,
    logisticMode: logistic.mode || null,
    logisticType: logistic.type || null,
    dispatch: getMeliDispatchDetails(shipping),
    labelAvailable: printable,
    estimatedDelivery: shipping.lead_time?.estimated_delivery_time?.date || null,
    shippingCost: toNumber(shipping.lead_time?.list_cost, 0),
    dimensions: shipping.dimensions || null,
    updatedAt: new Date().toISOString(),
    raw: shipping,
  };
};

const preserveOperationalStatus = (currentStatus, remoteStatus) => {
  if (currentStatus === 'CANCELLED' || remoteStatus === 'CANCELLED') return 'CANCELLED';
  if (remoteStatus === 'DELIVERED') return 'DELIVERED';
  if (remoteStatus === 'SHIPPED') return 'SHIPPED';
  if (currentStatus === 'PROCESSING' && remoteStatus === 'PENDING_FULFILLMENT') return currentStatus;
  return remoteStatus;
};

const getPackageDimensionsUpdate = (shipping = {}) => {
  const dimensions = shipping.dimensions || {};
  const values = [dimensions.height, dimensions.width, dimensions.length, dimensions.weight].map(Number);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return {
    heightCm: values[0],
    widthCm: values[1],
    lengthCm: values[2],
    weightKg: values[3] / 1000,
  };
};

const buildMeliPaymentResult = (order = {}) => ({
  provider: 'mercadolibre',
  status: order.status || null,
  statusDetail: order.status_detail || null,
  payments: order.payments || [],
  raw: {
    id: order.id,
    packId: order.pack_id,
    tags: order.tags,
  },
});

const getMeliPaymentFee = (order = {}) => {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  return payments
    .filter((payment) => String(payment?.status || '').toLowerCase() === 'approved')
    .reduce((total, payment) => total + toNumber(payment?.marketplace_fee, 0), 0);
};

const getLineItemId = (line = {}) => line.item?.id || line.item_id || line.item?.item_id || null;

const collectSkuCandidates = (line = {}) => uniqueTruthy([
  line.item?.seller_sku,
  line.item?.seller_custom_field,
  line.item?.seller_custom_field_id,
  line.item?.sku,
  line.seller_sku,
  line.sku,
  line.variation_attributes?.find?.((attribute) => /sku/i.test(attribute.name || attribute.id || ''))?.value_name,
  getLineItemId(line),
]);

const getProductImage = (product) => product?.media?.find((media) => media.type === 'IMAGE')?.url
  || product?.media?.[0]?.url
  || null;

const resolveProductForMeliLine = async (line = {}) => {
  const itemId = getLineItemId(line);
  const skuCandidates = collectSkuCandidates(line);
  const title = line.item?.title || line.title || '';

  if (itemId) {
    const productByMeliId = await prisma.product.findUnique({
      where: { meliItemId: String(itemId) },
      include: { media: true, marketplaceListings: true },
    });
    if (productByMeliId) return { product: productByMeliId, match: 'meliItemId' };
  }

  if (itemId || skuCandidates.length > 0) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        channel: MELI_CHANNEL,
        OR: [
          ...(itemId ? [{ externalProductId: String(itemId) }] : []),
          ...skuCandidates.map((sku) => ({ externalSku: sku })),
        ],
      },
      include: { product: { include: { media: true, marketplaceListings: true } } },
    });
    if (listing?.product) return { product: listing.product, match: 'marketplaceListing' };
  }

  for (const sku of skuCandidates) {
    const productBySku = await prisma.product.findUnique({
      where: { sku },
      include: { media: true, marketplaceListings: true },
    });
    if (productBySku) return { product: productBySku, match: 'sku' };
  }

  const normalizedTitle = normalizeText(title);
  if (normalizedTitle) {
    const products = await prisma.product.findMany({
      where: { isArchived: false },
      include: { media: true, marketplaceListings: true },
      take: 200,
    });
    const productByTitle = products.find((product) => {
      const normalizedName = normalizeText(product.name);
      return normalizedName && (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle));
    });
    if (productByTitle) return { product: productByTitle, match: 'title' };
  }

  return {
    product: null,
    match: null,
    missing: {
      itemId: itemId ? String(itemId) : null,
      title,
      skuCandidates,
    },
  };
};

const resolveMeliOrderItems = async (order = {}) => {
  const lines = order.order_items || order.orderItems || [];
  const items = [];
  const unmatched = [];

  for (const line of lines) {
    const resolved = await resolveProductForMeliLine(line);
    if (!resolved.product) {
      unmatched.push(resolved.missing);
      continue;
    }

    const qty = toNumber(line.quantity, 1);
    const price = toNumber(line.unit_price, toNumber(line.full_unit_price, resolved.product.price || 0));

    items.push({
      name: line.item?.title || resolved.product.name,
      qty,
      image: getProductImage(resolved.product),
      price,
      unitCost: toNumber(resolved.product.costPrice, 0),
      productId: resolved.product.id,
      product: resolved.product,
      match: resolved.match,
      raw: line,
    });
  }

  return { items, unmatched };
};

const splitName = (fullName = '') => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Cliente', lastName: 'Mercado Libre' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'Mercado Libre' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1),
  };
};

const getOrCreateMeliCustomer = async (tx, order, externalOrderId) => {
  const email = getMeliCustomerEmail(order, externalOrderId).toLowerCase();
  const existingUser = await tx.user.findUnique({ where: { email } });
  const customerName = getMeliCustomerName(order);
  const { firstName, lastName } = splitName(customerName);
  const phone = getMeliPhone(order);

  if (existingUser) {
    return tx.user.update({
      where: { id: existingUser.id },
      data: {
        firstName: existingUser.firstName || firstName,
        lastName: existingUser.lastName || lastName,
        phone: existingUser.phone || phone || undefined,
      },
    });
  }

  const role = await tx.role.findUnique({ where: { name: 'USER' } });
  if (!role) throw new Error('No existe el rol USER para crear cliente Mercado Libre.');

  const randomPassword = crypto.randomBytes(24).toString('hex');
  const password = await bcrypt.hash(randomPassword, 10);

  return tx.user.create({
    data: {
      firstName,
      lastName,
      email,
      password,
      countryCode: 'MX',
      phone,
      isVerified: true,
      roleId: role.id,
    },
  });
};

const writeMeliImportLog = async ({ status, order = null, orderNumber = null, externalOrderId, message, details, error }) => writeNotificationLog({
  channel: 'SYSTEM',
  audience: 'SYSTEM',
  event: 'mercadolibre_order_import',
  status,
  provider: 'mercadolibre',
  order,
  orderNumber,
  recipient: externalOrderId,
  message,
  error,
  details,
});

const getAssignedMeliStock = async (tx, productId) => {
  const movements = await tx.inventoryMovement.findMany({
    where: { productId, channel: MELI_CHANNEL },
    select: { type: true, quantity: true },
  });

  return movements.reduce((total, movement) => {
    if (['CHANNEL_TRANSFER', 'RETURN_IN', 'ADJUSTMENT_IN'].includes(movement.type)) {
      return total + movement.quantity;
    }
    if (['SALE', 'ADJUSTMENT_OUT', 'RETURN_OUT'].includes(movement.type)) {
      return total - movement.quantity;
    }
    return total;
  }, 0);
};

const validateMeliAssignedStock = async (tx, items = []) => {
  const shortages = [];

  for (const item of items) {
    if (item.product?.productType === 'SUPPLIER_ON_DEMAND') {
      if (!hasProductAvailability(item.product, item.qty)) {
        shortages.push({
          sku: item.product?.sku,
          name: item.name,
          required: item.qty,
          available: getProductAvailableStock(item.product),
        });
      }
      continue;
    }
    if (item.product?.productType !== 'IN_HOUSE') continue;
    const available = await getAssignedMeliStock(tx, item.productId);
    if (available < item.qty) {
      shortages.push({
        sku: item.product?.sku,
        name: item.name,
        required: item.qty,
        available,
      });
    }
  }

  return shortages;
};

const getCurrentUserProfile = async (accessToken) => {
  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  } catch (error) {
    logger.warn('[Meli Service] No se pudo obtener perfil de vendedor:', error.response?.data || error.message);
    return null;
  }
};

const serializeIntegration = (integration) => {
  if (!integration) return null;
  return {
    id: integration.id,
    meliUserId: integration.meliUserId,
    nickname: integration.nickname,
    expiresAt: integration.expiresAt,
    connectedAt: integration.connectedAt,
    updatedAt: integration.updatedAt,
    needsReconnect: !integration.refreshToken,
  };
};

const getIntegration = async (userId = null) => {
  const where = userId ? { userId } : {};
  return prisma.meliIntegration.findFirst({
    where,
    orderBy: { updatedAt: 'desc' },
  });
};

const getIntegrationByMeliUserId = async (meliUserId = null) => {
  if (!meliUserId) return getIntegration();

  const integration = await prisma.meliIntegration.findFirst({
    where: { meliUserId: String(meliUserId) },
    orderBy: { updatedAt: 'desc' },
  });

  return integration || getIntegration();
};

const getIntegrationStatus = async (userId = null) => {
  const integration = await getIntegration(userId);
  return {
    isConnected: Boolean(integration),
    integration: serializeIntegration(integration),
  };
};

const refreshAccessToken = async (integration) => {
  assertMeliConfig();

  if (!integration?.refreshToken) {
    throw new Error('Mercado Libre no tiene refresh token. Reconecta la cuenta.');
  }

  const config = getConfig();
  logger.info(`[Meli Service] Refrescando token para usuario Mercado Libre: ${integration.meliUserId || integration.userId}`);

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', config.MERCADOLIBRE_APP_ID);
  params.append('client_secret', config.MERCADOLIBRE_CLIENT_SECRET);
  params.append('refresh_token', integration.refreshToken);

  try {
    const { data } = await axios.post(`${MELI_API_BASE_URL}/oauth/token`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    const updatedIntegration = await prisma.meliIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || integration.refreshToken,
        expiresIn: data.expires_in,
        expiresAt: toExpiresAt(data.expires_in),
        tokenType: data.token_type,
        scope: data.scope,
        rawData: data,
      },
    });

    logger.success(`[Meli Service] Token refrescado para usuario Mercado Libre: ${updatedIntegration.meliUserId || updatedIntegration.userId}`);
    return updatedIntegration.accessToken;
  } catch (error) {
    logger.error('[Meli Service] Error al refrescar token:', error.response?.data || error.message);
    throw new Error('No se pudo refrescar Mercado Libre. Reconecta la cuenta.');
  }
};

const getValidAccessToken = async (userId = null) => {
  const integration = await getIntegration(userId);

  if (!integration) {
    logger.warn('[Meli Service] No se encontro integracion de Mercado Libre.');
    return null;
  }

  const bufferSeconds = 300;
  const isTokenExpired = !integration.expiresAt || new Date() > new Date(integration.expiresAt.getTime() - bufferSeconds * 1000);

  if (isTokenExpired) {
    return refreshAccessToken(integration);
  }

  return integration.accessToken;
};

const exchangeCodeForToken = async (code, codeVerifier, userId) => {
  const config = assertMeliConfig();

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('client_id', config.MERCADOLIBRE_APP_ID);
  params.append('client_secret', config.MERCADOLIBRE_CLIENT_SECRET);
  params.append('code', code);
  params.append('redirect_uri', config.MERCADOLIBRE_REDIRECT_URI);
  if (codeVerifier) params.append('code_verifier', codeVerifier);

  try {
    const { data } = await axios.post(`${MELI_API_BASE_URL}/oauth/token`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    const profile = await getCurrentUserProfile(data.access_token);

    const integration = await prisma.meliIntegration.upsert({
      where: { userId },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: toExpiresAt(data.expires_in),
        meliUserId: data.user_id ? String(data.user_id) : null,
        nickname: profile?.nickname || profile?.email || null,
        tokenType: data.token_type,
        scope: data.scope,
        rawData: { token: data, profile },
      },
      create: {
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: toExpiresAt(data.expires_in),
        meliUserId: data.user_id ? String(data.user_id) : null,
        nickname: profile?.nickname || profile?.email || null,
        tokenType: data.token_type,
        scope: data.scope,
        rawData: { token: data, profile },
      },
    });

    logger.success(`[Meli Service] Integracion guardada para usuario ${userId}`);
    return serializeIntegration(integration);
  } catch (error) {
    logger.error('[Meli Service] Error al intercambiar codigo:', error.response?.data || error.message);
    throw new Error('Error al conectar Mercado Libre. Verifica App ID, Secret y Redirect URI.');
  }
};

const getMeliSellerId = async () => {
  const integration = await getIntegration();
  return integration?.meliUserId || null;
};

const fetchMeliOrders = async (sellerId, userId = null) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/orders/search`, {
      params: { seller: sellerId, sort: 'date_desc', limit: 50 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.results || [];
  } catch (error) {
    logger.error('[Meli Service] Error al obtener pedidos:', error.response?.data || error.message);
    throw new Error('No se pudieron obtener pedidos de Mercado Libre.');
  }
};

const getOrder = async (orderId, userId = null) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  } catch (error) {
    logger.error(`[Meli Service] Error al obtener orden ${orderId}:`, error.response?.data || error.message);
    return null;
  }
};

const getShipment = async (userId, shipmentId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/shipments/${shipmentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-format-new': 'true',
      },
    });
    return data;
  } catch (error) {
    logger.error(`[Meli Service] Error al obtener envio ${shipmentId}:`, error.response?.data || error.message);
    throw new Error(getMeliErrorMessage(error, 'No se pudo consultar el envio de Mercado Libre.'));
  }
};

const getShipmentLabel = async (userId, shipmentId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  try {
    const response = await axios.get(`${MELI_API_BASE_URL}/shipment_labels`, {
      params: { shipment_ids: shipmentId, response_type: 'pdf' },
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });
    return {
      data: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'application/pdf',
    };
  } catch (error) {
    logger.error(`[Meli Service] Error al obtener etiqueta ${shipmentId}:`, error.response?.data || error.message);
    throw new Error(getMeliErrorMessage(
      error,
      'La etiqueta aun no esta disponible. El envio debe estar listo para imprimir.'
    ));
  }
};

const enrichMeliOrderWithShipment = async (order = {}, userId = null) => {
  const shipmentId = order.shipping?.id;
  if (!shipmentId) return order;
  const shipment = await getShipment(userId, shipmentId);
  return { ...order, shipping: shipment || order.shipping };
};

const refreshExistingMeliOrder = async (existingOrder, existingExternalOrder, meliOrder) => {
  const remoteStatus = mapMeliStatusToOrderStatus(meliOrder);
  const nextStatus = preserveOperationalStatus(existingOrder.status, remoteStatus);
  const paymentFee = getMeliPaymentFee(meliOrder);
  const totalPrice = toNumber(meliOrder.paid_amount, toNumber(meliOrder.total_amount, existingOrder.totalPrice));
  const shippingInfo = buildMeliShippingInfo(meliOrder);
  const shippingAddress = buildMeliShippingAddress(meliOrder);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: existingOrder.id },
      data: {
        status: nextStatus,
        isPaid: isPaidMeliOrder(meliOrder),
        paymentFee,
        totalPrice,
        shippingPrice: shippingInfo.shippingCost,
        shippingAddress,
        shippingInfo,
        isDelivered: nextStatus === 'DELIVERED',
        ...(nextStatus === 'DELIVERED' ? { deliveredAt: toSafeDate(meliOrder.shipping?.last_updated) || new Date() } : {}),
        ...(['SHIPPED', 'DELIVERED'].includes(nextStatus)
          ? { shippedAt: existingOrder.shippedAt || toSafeDate(meliOrder.shipping?.last_updated) || new Date() }
          : {}),
      },
    });
    if (existingExternalOrder) {
      await tx.externalOrder.update({
        where: { id: existingExternalOrder.id },
        data: {
          externalStatus: meliOrder.status || null,
          totalPrice,
          shippingPrice: shippingInfo.shippingCost,
          feesEstimated: paymentFee,
          netRevenue: Math.max(totalPrice - paymentFee - shippingInfo.shippingCost, 0),
          rawData: { meliOrder },
        },
      });
    }
    const packageDimensions = getPackageDimensionsUpdate(meliOrder.shipping);
    if (packageDimensions && existingOrder.orderItems?.length === 1 && existingOrder.orderItems[0].qty === 1) {
      await tx.product.update({
        where: { id: existingOrder.orderItems[0].productId },
        data: packageDimensions,
      });
    }
    return tx.order.findUnique({ where: { id: updated.id }, include: ORDER_INCLUDE });
  });
};

const importMeliOrder = async (meliOrder = {}, { userId = null, notifyStaff = true } = {}) => {
  const externalOrderId = cleanMeliOrderId(meliOrder.id || meliOrder.resource);
  if (!externalOrderId) {
    throw new Error('La orden de Mercado Libre no tiene identificador.');
  }

  const orderNumber = `${MELI_ORDER_PREFIX}-${externalOrderId}`;
  const existingExternalOrder = await prisma.externalOrder.findUnique({
    where: {
      channel_externalOrderId: {
        channel: MELI_CHANNEL,
        externalOrderId,
      },
    },
    include: { order: { include: ORDER_INCLUDE } },
  });

  if (existingExternalOrder?.order) {
    const refreshedOrder = await refreshExistingMeliOrder(
      existingExternalOrder.order,
      existingExternalOrder,
      meliOrder
    );
    return {
      action: 'refreshed',
      externalOrderId,
      order: refreshedOrder,
    };
  }

  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber },
    include: ORDER_INCLUDE,
  });

  if (existingOrder) {
    await prisma.externalOrder.upsert({
      where: {
        channel_externalOrderId: {
          channel: MELI_CHANNEL,
          externalOrderId,
        },
      },
      update: {
        orderId: existingOrder.id,
        externalStatus: meliOrder.status || null,
        rawData: meliOrder,
      },
      create: {
        channel: MELI_CHANNEL,
        externalOrderId,
        externalStatus: meliOrder.status || null,
        customerName: getMeliCustomerName(meliOrder),
        totalPrice: toNumber(meliOrder.total_amount, toNumber(meliOrder.paid_amount, 0)),
        orderedAt: toSafeDate(meliOrder.date_created),
        rawData: meliOrder,
        orderId: existingOrder.id,
      },
    });

    return {
      action: 'existing',
      externalOrderId,
      order: existingOrder,
    };
  }

  const { items, unmatched } = await resolveMeliOrderItems(meliOrder);
  const isPaid = isPaidMeliOrder(meliOrder);
  const orderStatus = mapMeliStatusToOrderStatus(meliOrder);
  const shippingPrice = toNumber(meliOrder.shipping?.cost, 0);
  const itemsPrice = items.reduce((total, item) => total + item.qty * item.price, 0);
  const totalPrice = toNumber(meliOrder.paid_amount, toNumber(meliOrder.total_amount, itemsPrice + shippingPrice));
  const paymentFee = getMeliPaymentFee(meliOrder);
  const netRevenue = Math.max(totalPrice - paymentFee, 0);

  if (items.length === 0) {
    await prisma.externalOrder.upsert({
      where: {
        channel_externalOrderId: {
          channel: MELI_CHANNEL,
          externalOrderId,
        },
      },
      update: {
        externalStatus: meliOrder.status || null,
        customerName: getMeliCustomerName(meliOrder),
        totalPrice,
        shippingPrice,
        orderedAt: toSafeDate(meliOrder.date_created),
        rawData: { meliOrder, unmatched },
      },
      create: {
        channel: MELI_CHANNEL,
        externalOrderId,
        externalStatus: meliOrder.status || null,
        customerName: getMeliCustomerName(meliOrder),
        totalPrice,
        shippingPrice,
        orderedAt: toSafeDate(meliOrder.date_created),
        rawData: { meliOrder, unmatched },
      },
    });

    await writeMeliImportLog({
      status: 'SKIPPED',
      externalOrderId,
      orderNumber,
      message: 'Orden Mercado Libre sin producto local vinculado. No se creo pedido interno.',
      details: { unmatched, meliOrderId: externalOrderId },
    });

    return {
      action: 'skipped',
      externalOrderId,
      order: null,
      unmatched,
    };
  }

  let inventoryWarning = null;

  const order = await prisma.$transaction(async (tx) => {
    const customer = await getOrCreateMeliCustomer(tx, meliOrder, externalOrderId);
    const shortages = isPaid && orderStatus !== 'CANCELLED'
      ? await validateMeliAssignedStock(tx, items)
      : [];

    if (shortages.length > 0) {
      inventoryWarning = shortages
        .map((item) => `${item.sku || item.name}: requiere ${item.required}, disponible ${item.available}`)
        .join('; ');
    }

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        itemsPrice,
        taxPrice: 0,
        shippingPrice,
        totalPrice,
        paymentFee,
        isPaid,
        paidAt: isPaid ? (toSafeDate(meliOrder.date_closed) || toSafeDate(meliOrder.date_created) || new Date()) : null,
        paymentMethod: 'Mercado Libre',
        paymentResult: buildMeliPaymentResult(meliOrder),
        salesChannel: MELI_CHANNEL,
        status: orderStatus,
        isDelivered: orderStatus === 'DELIVERED',
        deliveredAt: orderStatus === 'DELIVERED' ? (toSafeDate(meliOrder.shipping?.status_history?.date_delivered) || new Date()) : null,
        shippedAt: ['SHIPPED', 'DELIVERED'].includes(orderStatus)
          ? (toSafeDate(meliOrder.shipping?.status_history?.date_shipped) || new Date())
          : null,
        shippingAddress: buildMeliShippingAddress(meliOrder),
        shippingInfo: buildMeliShippingInfo(meliOrder),
        createdAt: toSafeDate(meliOrder.date_created) || undefined,
        userId: customer.id,
        orderItems: {
          create: items.map(({ product, raw, match, ...item }) => item),
        },
        statusHistory: {
          create: {
            status: orderStatus,
            notes: isPaid
              ? 'Pedido importado desde Mercado Libre con pago confirmado.'
              : 'Pedido importado desde Mercado Libre pendiente de pago.',
          },
        },
      },
      include: ORDER_INCLUDE,
    });

    await tx.externalOrder.upsert({
      where: {
        channel_externalOrderId: {
          channel: MELI_CHANNEL,
          externalOrderId,
        },
      },
      update: {
        externalStatus: meliOrder.status || null,
        customerName: getMeliCustomerName(meliOrder),
        totalPrice,
        shippingPrice,
        feesEstimated: paymentFee,
        netRevenue,
        orderedAt: toSafeDate(meliOrder.date_created),
        rawData: { meliOrder, matchedItems: items.map((item) => ({ productId: item.productId, match: item.match })) },
        orderId: createdOrder.id,
      },
      create: {
        channel: MELI_CHANNEL,
        externalOrderId,
        externalStatus: meliOrder.status || null,
        customerName: getMeliCustomerName(meliOrder),
        totalPrice,
        shippingPrice,
        feesEstimated: paymentFee,
        netRevenue,
        orderedAt: toSafeDate(meliOrder.date_created),
        rawData: { meliOrder, matchedItems: items.map((item) => ({ productId: item.productId, match: item.match })) },
        orderId: createdOrder.id,
      },
    });

    if (inventoryWarning) {
      await tx.statusHistory.create({
        data: {
          orderId: createdOrder.id,
          status: orderStatus,
          notes: `Advertencia inventario Mercado Libre: ${inventoryWarning}`,
        },
      });
    } else if (isPaid && orderStatus !== 'CANCELLED') {
      await applyPaidOrderInventoryMovements(tx, createdOrder, userId);
    }

    const packageDimensions = getPackageDimensionsUpdate(meliOrder.shipping);
    if (packageDimensions && createdOrder.orderItems?.length === 1 && createdOrder.orderItems[0].qty === 1) {
      await tx.product.update({
        where: { id: createdOrder.orderItems[0].productId },
        data: packageDimensions,
      });
    }

    return tx.order.findUnique({
      where: { id: createdOrder.id },
      include: ORDER_INCLUDE,
    });
  });

  await writeMeliImportLog({
    status: inventoryWarning ? 'SKIPPED' : 'SENT',
    externalOrderId,
    order,
    orderNumber,
    message: inventoryWarning
      ? `Pedido Mercado Libre creado, pero requiere revision de inventario: ${inventoryWarning}`
      : `Pedido Mercado Libre importado como ${order.orderNumber}.`,
    details: { externalOrderId, orderId: order.id, inventoryWarning, unmatched },
  });

  if (notifyStaff && isPaid && order) {
    try {
      await notifyStaffOrderPaid(order);
    } catch (notificationError) {
      logger.error(
        `[MercadoLibre] Orden ${order.orderNumber} importada, pero fallo el aviso al equipo: ${notificationError.message}`
      );
    }
  }

  return {
    action: 'created',
    externalOrderId,
    order,
    inventoryWarning,
    unmatched,
  };
};

const syncMeliOrders = async (userId = null) => {
  const integration = await getIntegration(userId);
  const sellerId = integration?.meliUserId;

  if (!sellerId) {
    throw new Error('No se ha conectado Mercado Libre.');
  }

  const orders = await fetchMeliOrders(sellerId, integration.userId || userId);
  const imports = [];

  for (const order of orders) {
    const externalOrderId = cleanMeliOrderId(order.id || order.resource);
    try {
      const orderDetail = externalOrderId
        ? await getOrder(externalOrderId, integration.userId || userId)
        : null;
      const enrichedOrder = await enrichMeliOrderWithShipment(
        orderDetail || order,
        integration.userId || userId
      );

      imports.push(await importMeliOrder(enrichedOrder, {
        userId: integration.userId || userId,
        notifyStaff: true,
      }));
    } catch (error) {
      logger.error(`[Meli Service] No se pudo importar orden ${externalOrderId}:`, error.message);
      await writeMeliImportLog({
        status: 'FAILED',
        externalOrderId,
        orderNumber: `${MELI_ORDER_PREFIX}-${externalOrderId}`,
        message: 'No se pudo importar orden Mercado Libre.',
        error: error.message,
        details: { externalOrderId },
      });
      imports.push({
        action: 'failed',
        externalOrderId,
        error: error.message,
      });
    }
  }

  return {
    count: orders.length,
    orders,
    imports,
  };
};

const getItem = async (userId, meliItemId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/items/${meliItemId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  } catch (error) {
    logger.error(`[Meli Service] Error al obtener item ${meliItemId}:`, error.response?.data || error.message);
    return null;
  }
};

const searchSellerItemsBySku = async (userId, sku) => {
  const integration = await getIntegration(userId);
  const sellerId = integration?.meliUserId;
  const normalizedSku = String(sku || '').trim();
  if (!sellerId || !normalizedSku) return [];

  const accessToken = await getValidAccessToken(integration.userId || userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const searches = await Promise.all(['sku', 'seller_sku'].map((parameter) => axios.get(
      `${MELI_API_BASE_URL}/users/${sellerId}/items/search`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { [parameter]: normalizedSku, limit: 50 },
      }
    )));
    const itemIds = uniqueTruthy(searches.flatMap(({ data }) => data?.results || []));
    const items = await Promise.all(itemIds.map(async (itemId) => {
      try {
        const { data } = await axios.get(`${MELI_API_BASE_URL}/items/${itemId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        return data || null;
      } catch {
        return null;
      }
    }));
    return items.filter(Boolean);
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudieron buscar publicaciones por SKU ${normalizedSku}: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudieron comprobar las publicaciones existentes.'));
  }
};

const decodeMeliText = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
  .replace(/&nbsp;/gi, ' ')
  .trim();

const getMeliDetailMessages = (value) => {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(getMeliDetailMessages);

  if (typeof value !== 'object') {
    const text = decodeMeliText(value);
    return text ? [text] : [];
  }

  const primary = [value.code || value.error, value.message || value.detail || value.description]
    .map(decodeMeliText)
    .filter(Boolean)
    .join(': ');

  return [
    primary,
    ...getMeliDetailMessages(value.references),
    ...getMeliDetailMessages(value.fields),
    ...getMeliDetailMessages(value.field),
    ...getMeliDetailMessages(value.path),
  ].filter(Boolean);
};

const getMeliErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const details = [
    ...getMeliDetailMessages(data?.message),
    ...getMeliDetailMessages(data?.error),
    ...getMeliDetailMessages(data?.cause),
    ...getMeliDetailMessages(data?.details),
    ...getMeliDetailMessages(data?.invalid_fields),
  ];

  if (details.length > 0) {
    const uniqueDetails = [...new Set(details)];
    if (uniqueDetails.length === 1 && uniqueDetails[0] === 'body.invalid_fields') {
      uniqueDetails.push('Mercado Libre no indico el campo invalido; revisa la categoria y sus atributos obligatorios.');
    }
    return uniqueDetails.join('; ');
  }

  return decodeMeliText(error?.message) || fallback;
};

const predictCategories = async (userId, title, limit = 3) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(
      `${MELI_API_BASE_URL}/sites/MLM/domain_discovery/search`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { q: title, limit: Math.min(Math.max(Number(limit) || 3, 1), 8) },
      }
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo predecir categoria: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo sugerir una categoria de Mercado Libre.'));
  }
};

const predictCategory = async (userId, title) => {
  const predictions = await predictCategories(userId, title, 1);
  return predictions[0] || null;
};

const getCategory = async (userId, categoryId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(
      `${MELI_API_BASE_URL}/categories/${categoryId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data || null;
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo leer la categoria ${categoryId}: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo leer la categoria de Mercado Libre.'));
  }
};

const getCategoryAttributes = async (userId, categoryId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(
      `${MELI_API_BASE_URL}/categories/${categoryId}/attributes`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudieron leer atributos de ${categoryId}: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudieron leer los atributos de la categoria.'));
  }
};

const searchCatalogProducts = async (
  userId,
  { gtin, query, domainId, limit = 5 } = {}
) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  const normalizedGtin = String(gtin || '').replace(/\D/g, '');
  const normalizedQuery = String(query || '').trim();
  if (!normalizedGtin && !normalizedQuery) return [];

  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/products/search`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        site_id: 'MLM',
        status: 'active',
        ...(normalizedGtin
          ? { product_identifier: normalizedGtin }
          : { q: normalizedQuery }),
        ...(domainId ? { domain_id: domainId } : {}),
        limit: Math.min(Math.max(Number(limit) || 5, 1), 20),
      },
    });
    return Array.isArray(data?.results) ? data.results : [];
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo buscar el producto de catalogo: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo comprobar el catalogo de Mercado Libre.'));
  }
};

const getCatalogProduct = async (userId, catalogProductId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/products/${catalogProductId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data || null;
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo leer producto de catalogo ${catalogProductId}: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo validar el producto de catalogo.'));
  }
};

const getShippingPreferences = async (userId) => {
  const integration = await getIntegration(userId);
  const sellerId = integration?.meliUserId;
  if (!sellerId) {
    throw new Error('No se encontro el vendedor conectado de Mercado Libre.');
  }
  const accessToken = await getValidAccessToken(integration.userId || userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(
      `${MELI_API_BASE_URL}/users/${sellerId}/shipping_preferences`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return data || {};
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudieron leer preferencias de envio: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudieron validar las modalidades de envio.'));
  }
};

const getSellerProfile = async (userId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data || {};
  } catch (error) {
    logger.warn(`[MercadoLibre] No se pudo consultar el perfil fiscal: ${error.message}`);
    return {};
  }
};

const getDefaultShippingContext = (preferences = {}) => {
  const logistics = Array.isArray(preferences.logistics) ? preferences.logistics : [];
  const activeMode = logistics.find((entry) =>
    entry?.mode === 'me2'
    && (entry.types || []).some((type) => type?.status === 'active')
  ) || logistics.find((entry) => (entry.types || []).some((type) => type?.status === 'active'));
  const activeType = (activeMode?.types || []).find(
    (type) => type?.status === 'active' && type?.default
  ) || (activeMode?.types || []).find((type) => type?.status === 'active');

  return {
    mode: activeMode?.mode || (preferences.modes || []).find((mode) => mode === 'me2') || 'not_specified',
    logisticType: activeType?.type || (activeMode?.mode === 'me2' ? 'drop_off' : activeMode?.mode) || 'not_specified',
  };
};

const getListingPriceQuote = async (
  userId,
  { price, categoryId, listingTypeId, shippingMode, logisticType }
) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');

  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}/sites/MLM/listing_prices`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        price,
        currency_id: 'MXN',
        category_id: categoryId,
        listing_type_id: listingTypeId,
        shipping_mode: shippingMode,
        logistic_type: logisticType,
      },
    });
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo cotizar el cargo por venta: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo cotizar la comision de Mercado Libre.'));
  }
};

const getShippingCostQuote = async (
  userId,
  { price, listingTypeId, shippingMode, logisticType, condition, dimensions, itemId }
) => {
  const integration = await getIntegration(userId);
  const sellerId = integration?.meliUserId;
  if (!sellerId) throw new Error('No se encontro el vendedor conectado de Mercado Libre.');
  const accessToken = await getValidAccessToken(integration.userId || userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');

  try {
    const { data } = await axios.get(
      `${MELI_API_BASE_URL}/users/${sellerId}/shipping_options/free`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          ...(itemId ? { item_id: itemId } : { dimensions }),
          verbose: true,
          item_price: price,
          listing_type_id: listingTypeId,
          mode: shippingMode,
          logistic_type: logisticType,
          condition,
          free_shipping: true,
        },
      }
    );
    return data || {};
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo cotizar el envio: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo cotizar el envio de Mercado Libre.'));
  }
};

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const estimateTaxWithholdings = (price, sellerProfile = {}) => {
  const identificationType = String(sellerProfile?.identification?.type || '').toUpperCase();
  const hasRfc = identificationType === 'RFC';
  if (hasRfc) {
    return {
      hasRfc: true,
      taxableBase: money(Number(price) / 1.16),
      vatWithholding: 0,
      incomeTaxWithholding: 0,
      totalTaxWithholding: 0,
      estimated: false,
      message: 'RFC detectado. Las retenciones exactas dependen del regimen fiscal validado por Mercado Libre.',
    };
  }
  const taxableBase = money(Number(price) / 1.16);
  const vatWithholding = money(taxableBase * 0.16);
  const incomeTaxWithholding = money(taxableBase * 0.20);
  return {
    hasRfc: false,
    taxableBase,
    vatWithholding,
    incomeTaxWithholding,
    totalTaxWithholding: money(vatWithholding + incomeTaxWithholding),
    estimated: true,
    message: 'Mercado Libre no reporta un RFC valido y aplica las tasas maximas estimadas: 16% IVA y 20% ISR sobre la base sin IVA.',
  };
};

const quotePublicationCosts = async (
  userId,
  {
    targetNet,
    categoryId,
    listingTypeId,
    condition = 'new',
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    itemId = null,
  }
) => {
  const numericDimensions = [heightCm, widthCm, lengthCm, weightKg].map(Number);
  if (!itemId && numericDimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Completa peso, largo, ancho y alto para cotizar el envio de Mercado Libre.');
  }
  const dimensions = itemId ? null : `${Math.ceil(numericDimensions[0])}x${Math.ceil(numericDimensions[1])}x${Math.ceil(numericDimensions[2])},${Math.ceil(numericDimensions[3] * 1000)}`;
  const [preferences, sellerProfile] = await Promise.all([
    getShippingPreferences(userId),
    getSellerProfile(userId),
  ]);
  const { mode: shippingMode, logisticType } = getDefaultShippingContext(preferences);
  let recommendedPrice = money(targetNet);
  let listingPrice = null;
  let shippingQuote = null;
  let quotedPrice = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    quotedPrice = recommendedPrice;
    [listingPrice, shippingQuote] = await Promise.all([
      getListingPriceQuote(userId, {
        price: recommendedPrice,
        categoryId,
        listingTypeId,
        shippingMode,
        logisticType,
      }),
      getShippingCostQuote(userId, {
        price: recommendedPrice,
        listingTypeId,
        shippingMode,
        logisticType,
        condition,
        dimensions,
        itemId,
      }),
    ]);
    const saleFee = Number(listingPrice?.sale_fee_amount || 0);
    const listingFee = Number(listingPrice?.listing_fee_amount || 0);
    const shippingCost = Number(shippingQuote?.coverage?.all_country?.list_cost || 0);
    const taxWithholding = estimateTaxWithholdings(recommendedPrice, sellerProfile).totalTaxWithholding;
    const nextPrice = money(Number(targetNet) + saleFee + listingFee + shippingCost + taxWithholding);
    if (Math.abs(nextPrice - recommendedPrice) < 0.01) break;
    recommendedPrice = nextPrice;
  }

  if (quotedPrice !== recommendedPrice) {
    [listingPrice, shippingQuote] = await Promise.all([
      getListingPriceQuote(userId, {
        price: recommendedPrice,
        categoryId,
        listingTypeId,
        shippingMode,
        logisticType,
      }),
      getShippingCostQuote(userId, {
        price: recommendedPrice,
        listingTypeId,
        shippingMode,
        logisticType,
        condition,
        dimensions,
        itemId,
      }),
    ]);
  }

  const saleFee = money(listingPrice?.sale_fee_amount || 0);
  const listingFee = money(listingPrice?.listing_fee_amount || 0);
  const shippingCost = money(shippingQuote?.coverage?.all_country?.list_cost || 0);
  const taxWithholdings = estimateTaxWithholdings(recommendedPrice, sellerProfile);
  const totalCharges = money(saleFee + listingFee + shippingCost + taxWithholdings.totalTaxWithholding);
  return {
    listingTypeId,
    listingTypeName: listingPrice?.listing_type_name || listingTypeId,
    targetNet: money(targetNet),
    recommendedPrice,
    saleFee,
    listingFee,
    shippingCost,
    ...taxWithholdings,
    totalCharges,
    estimatedNet: money(recommendedPrice - totalCharges),
    commissionPercentage: Number(listingPrice?.sale_fee_details?.percentage_fee || 0),
    shippingMode,
    logisticType,
    billableWeightGrams: Number(
      shippingQuote?.coverage?.all_country?.billable_weight
      || (Number.isFinite(numericDimensions[3]) ? Math.ceil(numericDimensions[3] * 1000) : 0)
    ),
    currencyId: listingPrice?.currency_id || 'MXN',
  };
};

const estimatePublicationCostsAtPrice = async (
  userId,
  {
    price,
    categoryId,
    listingTypeId,
    condition = 'new',
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    itemId = null,
  }
) => {
  const numericDimensions = [heightCm, widthCm, lengthCm, weightKg].map(Number);
  if (!itemId && numericDimensions.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const dimensions = itemId ? null : `${Math.ceil(numericDimensions[0])}x${Math.ceil(numericDimensions[1])}x${Math.ceil(numericDimensions[2])},${Math.ceil(numericDimensions[3] * 1000)}`;
  const [preferences, sellerProfile] = await Promise.all([
    getShippingPreferences(userId),
    getSellerProfile(userId),
  ]);
  const { mode: shippingMode, logisticType } = getDefaultShippingContext(preferences);
  const [listingPrice, shippingQuote] = await Promise.all([
    getListingPriceQuote(userId, {
      price,
      categoryId,
      listingTypeId,
      shippingMode,
      logisticType,
    }),
    getShippingCostQuote(userId, {
      price,
      listingTypeId,
      shippingMode,
      logisticType,
      condition,
      dimensions,
      itemId,
    }),
  ]);
  const saleFee = money(listingPrice?.sale_fee_amount || 0);
  const listingFee = money(listingPrice?.listing_fee_amount || 0);
  const shippingCost = money(shippingQuote?.coverage?.all_country?.list_cost || 0);
  const taxWithholdings = estimateTaxWithholdings(price, sellerProfile);
  const totalCharges = money(saleFee + listingFee + shippingCost + taxWithholdings.totalTaxWithholding);
  return {
    listingTypeId,
    listingTypeName: listingPrice?.listing_type_name || listingTypeId,
    listedPrice: money(price),
    saleFee,
    listingFee,
    shippingCost,
    ...taxWithholdings,
    totalCharges,
    estimatedNet: money(Number(price) - totalCharges),
    commissionPercentage: Number(listingPrice?.sale_fee_details?.percentage_fee || 0),
    shippingMode,
    logisticType,
    currencyId: listingPrice?.currency_id || 'MXN',
  };
};

const uploadPictureFromUrl = async (userId, pictureUrl) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');

  try {
    const source = await axios.get(pictureUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const contentType = String(source.headers['content-type'] || 'image/jpeg').split(';')[0];
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const form = new FormData();
    form.append('file', new Blob([source.data], { type: contentType }), `product.${extension}`);
    const { data } = await axios.post(`${MELI_API_BASE_URL}/pictures/items/upload`, form, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 60000,
    });
    return data;
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo cargar imagen ${pictureUrl}: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'Mercado Libre no pudo procesar una imagen del producto.'));
  }
};

const updateItemPictures = async (userId, itemId, pictureIds = []) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  try {
    const { data } = await axios.put(
      `${MELI_API_BASE_URL}/items/${itemId}`,
      { pictures: pictureIds.map((id) => ({ id })) },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );
    return data;
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudieron actualizar imagenes de ${itemId}: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudieron actualizar las imagenes en Mercado Libre.'));
  }
};

const validateItem = async (userId, payload) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    await axios.post(`${MELI_API_BASE_URL}/items/validate`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return { valid: true, warnings: [] };
  } catch (error) {
    const causes = Array.isArray(error?.response?.data?.cause)
      ? error.response.data.cause
      : [];
    const onlyWarnings = causes.length > 0
      && causes.every((cause) => String(cause?.type || '').toLowerCase() === 'warning');
    if (onlyWarnings) {
      return {
        valid: true,
        warnings: causes.map((cause) => ({
          code: cause.code || null,
          message: decodeMeliText(cause.message),
        })),
      };
    }
    logger.error(
      `[MercadoLibre] La validacion previa rechazo el payload: ${JSON.stringify(error?.response?.data || error.message)}`
    );
    throw new Error(getMeliErrorMessage(error, 'Mercado Libre rechazo la validacion previa.'));
  }
};

const createItem = async (userId, payload) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.post(`${MELI_API_BASE_URL}/items`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return data;
  } catch (error) {
    logger.error(
      `[MercadoLibre] No se pudo publicar: ${JSON.stringify(error?.response?.data || error.message)}`
    );
    throw new Error(getMeliErrorMessage(error, 'Mercado Libre rechazo la publicacion.'));
  }
};

const createItemDescription = async (userId, itemId, plainText) => {
  if (!plainText?.trim()) {
    return null;
  }

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.post(
      `${MELI_API_BASE_URL}/items/${itemId}/description`,
      { plain_text: plainText.trim() },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return data;
  } catch (error) {
    logger.warn(
      `[MercadoLibre] ${itemId} se publico, pero fallo su descripcion: ${error.message}`
    );
    return null;
  }
};

const updateStock = async (userId, meliItemId, newStock) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.put(
      `${MELI_API_BASE_URL}/items/${meliItemId}`,
      { available_quantity: Number(newStock) },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data;
  } catch (error) {
    logger.error(`[Meli Service] Error al actualizar stock ${meliItemId}:`, error.response?.data || error.message);
    throw new Error('No se pudo sincronizar el stock con Mercado Libre.');
  }
};

const updatePriceAndStock = async (userId, meliItemId, { price, stock }) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.put(
      `${MELI_API_BASE_URL}/items/${meliItemId}`,
      {
        price: money(price),
        available_quantity: Number(stock),
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data;
  } catch (error) {
    logger.error(
      `[Meli Service] Error al actualizar precio y stock ${meliItemId}:`,
      error.response?.data || error.message
    );
    throw new Error(getMeliErrorMessage(
      error,
      'No se pudieron sincronizar el precio y el stock con Mercado Libre.'
    ));
  }
};

const optionalMeliGet = async (accessToken, path, params = undefined) => {
  try {
    const { data } = await axios.get(`${MELI_API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(params ? { params } : {}),
    });
    return data;
  } catch (error) {
    if ([400, 404].includes(error.response?.status)) return null;
    throw error;
  }
};

const getClaimDueDate = (claim = {}, detail = {}) => {
  if (detail?.due_date) return toSafeDate(detail.due_date);
  const seller = (claim.players || []).find((player) => player.role === 'respondent');
  const dates = (seller?.available_actions || [])
    .map((action) => toSafeDate(action.due_date))
    .filter(Boolean)
    .sort((left, right) => left - right);
  return dates[0] || null;
};

const getClaimExternalOrderId = (claim = {}, returnData = null) => {
  if (claim.resource === 'order' && claim.resource_id) return String(claim.resource_id);
  const returnOrder = (returnData?.orders || [])[0];
  return returnOrder?.order_id ? String(returnOrder.order_id) : null;
};

const syncMeliClaimById = async (userId, externalClaimId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  const claimId = String(externalClaimId || '').replace(/\D/g, '');
  if (!claimId) throw new Error('El identificador del reclamo no es valido.');

  const claim = await optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}`);
  if (!claim) throw new Error(`No se encontro el reclamo ${claimId} en Mercado Libre.`);

  const [detail, messages, history, resolutions, returnPayload, reputation] = await Promise.all([
    optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}/detail`),
    optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}/messages`),
    optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}/status_history`),
    optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}/expected_resolutions`),
    optionalMeliGet(accessToken, `/post-purchase/v2/claims/${claimId}/returns`),
    optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}/affects-reputation`),
  ]);
  const returnData = Array.isArray(returnPayload) ? returnPayload[0] : returnPayload;
  const returnShipment = (returnData?.shipments || [])[0] || {};
  const returnCostData = returnData
    ? await optionalMeliGet(accessToken, `/post-purchase/v1/claims/${claimId}/charges/return-cost`)
    : null;
  const externalOrderId = getClaimExternalOrderId(claim, returnData);
  const externalOrder = externalOrderId
    ? await prisma.externalOrder.findUnique({
      where: { channel_externalOrderId: { channel: MELI_CHANNEL, externalOrderId } },
      select: { orderId: true },
    })
    : null;
  const sellerPlayer = (claim.players || []).find((player) => player.role === 'respondent');

  return prisma.meliClaim.upsert({
    where: { externalClaimId: claimId },
    create: {
      externalClaimId: claimId,
      externalOrderId,
      sellerId: sellerPlayer?.user_id ? String(sellerPlayer.user_id) : null,
      type: claim.type || null,
      stage: claim.stage || null,
      status: claim.status || 'unknown',
      resource: claim.resource || null,
      resourceId: claim.resource_id ? String(claim.resource_id) : null,
      reasonId: claim.reason_id || null,
      reasonDetail: detail?.problem || null,
      title: detail?.title || null,
      description: detail?.description || null,
      problem: detail?.problem || null,
      actionResponsible: detail?.action_responsible || null,
      dueDate: getClaimDueDate(claim, detail),
      affectsReputation: typeof reputation?.affects_reputation === 'boolean'
        ? reputation.affects_reputation
        : null,
      returnId: returnData?.id ? String(returnData.id) : null,
      returnStatus: returnData?.status || null,
      returnShipmentId: returnShipment.shipment_id ? String(returnShipment.shipment_id) : null,
      returnTrackingNumber: returnShipment.tracking_number || null,
      returnCost: returnCostData?.amount != null ? Number(returnCostData.amount) : null,
      returnCurrency: returnCostData?.currency_id || null,
      refundAt: returnData?.refund_at || null,
      moneyStatus: returnData?.status_money || null,
      rawData: claim,
      detailData: nullableJson(detail),
      messagesData: nullableJson(messages),
      returnData: nullableJson(returnData),
      historyData: nullableJson(history),
      resolutionsData: nullableJson(resolutions),
      orderId: externalOrder?.orderId || null,
    },
    update: {
      externalOrderId,
      sellerId: sellerPlayer?.user_id ? String(sellerPlayer.user_id) : null,
      type: claim.type || null,
      stage: claim.stage || null,
      status: claim.status || 'unknown',
      resource: claim.resource || null,
      resourceId: claim.resource_id ? String(claim.resource_id) : null,
      reasonId: claim.reason_id || null,
      reasonDetail: detail?.problem || null,
      title: detail?.title || null,
      description: detail?.description || null,
      problem: detail?.problem || null,
      actionResponsible: detail?.action_responsible || null,
      dueDate: getClaimDueDate(claim, detail),
      affectsReputation: typeof reputation?.affects_reputation === 'boolean'
        ? reputation.affects_reputation
        : null,
      returnId: returnData?.id ? String(returnData.id) : null,
      returnStatus: returnData?.status || null,
      returnShipmentId: returnShipment.shipment_id ? String(returnShipment.shipment_id) : null,
      returnTrackingNumber: returnShipment.tracking_number || null,
      returnCost: returnCostData?.amount != null ? Number(returnCostData.amount) : null,
      returnCurrency: returnCostData?.currency_id || null,
      refundAt: returnData?.refund_at || null,
      moneyStatus: returnData?.status_money || null,
      rawData: claim,
      detailData: nullableJson(detail),
      messagesData: nullableJson(messages),
      returnData: nullableJson(returnData),
      historyData: nullableJson(history),
      resolutionsData: nullableJson(resolutions),
      orderId: externalOrder?.orderId || null,
      lastSyncedAt: new Date(),
    },
    include: {
      order: { select: { id: true, orderNumber: true, status: true, totalPrice: true } },
      activities: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
};

const syncMeliClaims = async (userId) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  const responses = await Promise.all(['opened', 'closed'].map((status) => axios.get(
    `${MELI_API_BASE_URL}/post-purchase/v1/claims/search`,
    {
      params: { status, limit: 100, sort: 'last_updated:desc' },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )));
  const claimsById = new Map();
  responses.forEach(({ data }) => {
    const statusClaims = Array.isArray(data?.data) ? data.data : [];
    statusClaims.forEach((claim) => claimsById.set(String(claim.id), claim));
  });
  const results = [...claimsById.values()];
  const synced = [];
  for (let index = 0; index < results.length; index += 5) {
    const batch = results.slice(index, index + 5);
    const settled = await Promise.allSettled(batch.map((claim) => syncMeliClaimById(userId, claim.id)));
    settled.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') synced.push(result.value);
      else logger.warn(`[MercadoLibre] No se pudo sincronizar reclamo ${batch[batchIndex].id}: ${result.reason?.message}`);
    });
  }
  const total = responses.reduce((sum, { data }) => sum + Number(data?.paging?.total || 0), 0);
  return { count: synced.length, claims: synced, total: total || results.length };
};

const sendMeliClaimMessage = async (userId, externalClaimId, { message, receiverRole }) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  const payload = {
    receiver_role: receiverRole,
    message: String(message || '').trim(),
    attachments: [],
  };
  if (!payload.message) throw new Error('El mensaje no puede estar vacio.');
  await axios.post(
    `${MELI_API_BASE_URL}/post-purchase/v1/claims/${externalClaimId}/actions/send-message`,
    payload,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
  );
  try {
    return await syncMeliClaimById(userId, externalClaimId);
  } catch (error) {
    logger.warn(`[MercadoLibre] Mensaje enviado en reclamo ${externalClaimId}, pero fallo la resincronizacion: ${error.message}`);
    return prisma.meliClaim.findUnique({ where: { externalClaimId: String(externalClaimId) } });
  }
};

const executeMeliClaimAction = async (userId, externalClaimId, action) => {
  const endpoints = {
    allow_return: `/post-purchase/v1/claims/${externalClaimId}/expected-resolutions/allow-return`,
    refund: `/post-purchase/v1/claims/${externalClaimId}/expected-resolutions/refund`,
    open_dispute: `/post-purchase/v1/claims/${externalClaimId}/actions/open-dispute`,
  };
  if (!endpoints[action]) throw new Error('La accion solicitada no esta permitida por Tecnotitlan.');
  const localClaim = await prisma.meliClaim.findUnique({ where: { externalClaimId: String(externalClaimId) } });
  if (!localClaim) throw new Error('Sincroniza el reclamo antes de ejecutar una accion.');
  const seller = (localClaim.rawData?.players || []).find((player) => player.role === 'respondent');
  const available = (seller?.available_actions || []).map((entry) => typeof entry === 'string' ? entry : entry.action);
  if (!available.includes(action)) {
    throw new Error(`Mercado Libre no reporta la accion ${action} como disponible en este momento.`);
  }
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('No hay token valido de Mercado Libre.');
  await axios.post(`${MELI_API_BASE_URL}${endpoints[action]}`, {}, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  try {
    return await syncMeliClaimById(userId, externalClaimId);
  } catch (error) {
    logger.warn(`[MercadoLibre] Accion ${action} aplicada en ${externalClaimId}, pero fallo la resincronizacion: ${error.message}`);
    return prisma.meliClaim.findUnique({ where: { externalClaimId: String(externalClaimId) } });
  }
};

const getWebhookSource = (notification = {}) => {
  if (notification.topic || notification.resource) return 'mercadolibre';
  if (notification.type || notification.action || notification.payment || notification.caller_id) return 'mercadopago';
  return 'unknown';
};

const summarizeWebhook = (notification = {}, source = 'unknown') => {
  if (source === 'mercadolibre') {
    return `Evento Mercado Libre recibido: ${notification.topic || 'sin-topic'} ${notification.resource || 'sin-resource'}`;
  }

  if (source === 'mercadopago') {
    const action = notification.action || notification.type || notification.payment?.state || 'sin-accion';
    const dataId = notification.data?.id || notification.payment?.id || notification.id || 'sin-id';
    return `Webhook Mercado Pago recibido: ${action} (${dataId}). No se importa como pedido Mercado Libre sin referencia valida.`;
  }

  return 'Webhook recibido con formato no reconocido.';
};

const processWebhookNotification = async (notification) => {
  const source = getWebhookSource(notification);
  const hasMeliOrderShape = Boolean(notification?.topic && notification?.resource);
  const isOrderNotification = hasMeliOrderShape
    && (
      String(notification.topic || '').toLowerCase().includes('orders')
      || String(notification.resource || '').toLowerCase().includes('/orders/')
    );
  const isShipmentNotification = hasMeliOrderShape
    && (
      String(notification.topic || '').toLowerCase().includes('shipment')
      || String(notification.resource || '').toLowerCase().includes('/shipments/')
    );
  const isClaimNotification = hasMeliOrderShape
    && String(notification.resource || '').toLowerCase().includes('/claims/')
    && (
      ['post_purchase', 'claims', 'claims_actions'].includes(String(notification.topic || '').toLowerCase())
      || (notification.actions || []).some((action) => ['claims', 'claims_actions'].includes(action))
    );

  logger.info(`[Meli Webhook] Evento recibido source=${source} topic=${notification?.topic || 'sin-topic'} resource=${notification?.resource || 'sin-resource'}`);

  await writeNotificationLog({
    channel: 'SYSTEM',
    audience: 'SYSTEM',
    event: hasMeliOrderShape ? `mercadolibre_webhook:${notification.topic}` : `${source}_webhook_received`,
    status: hasMeliOrderShape ? 'SENT' : 'SKIPPED',
    provider: 'mercadolibre',
    recipient: notification?.user_id ? String(notification.user_id) : null,
    message: summarizeWebhook(notification, source),
    details: {
      source,
      notification,
      importedAsExternalOrder: hasMeliOrderShape,
    },
  });

  if (!hasMeliOrderShape) return;

  const externalOrderId = cleanMeliOrderId(notification.resource);

  if (isClaimNotification) {
    try {
      const integration = await getIntegrationByMeliUserId(notification.user_id);
      const claim = await syncMeliClaimById(integration?.userId || null, externalOrderId);
      await prisma.meliClaimActivity.create({
        data: {
          claimId: claim.id,
          action: 'WEBHOOK_SYNC',
          actorName: 'Mercado Libre',
          details: { notification },
        },
      });
      return;
    } catch (error) {
      logger.warn(`[Meli Webhook] No se pudo actualizar reclamo ${externalOrderId}: ${error.message}`);
      return;
    }
  }

  if (isShipmentNotification) {
    try {
      const integration = await getIntegrationByMeliUserId(notification.user_id);
      const shipment = await getShipment(integration?.userId || null, externalOrderId);
      const candidateOrders = await prisma.order.findMany({
        where: { salesChannel: MELI_CHANNEL },
        include: { externalOrders: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const localOrder = candidateOrders.find(
        (order) => String(order.shippingInfo?.shippingId || '') === String(externalOrderId)
      );
      const linkedExternalOrderId = localOrder?.externalOrders?.find(
        (order) => order.channel === MELI_CHANNEL
      )?.externalOrderId;
      if (!linkedExternalOrderId) throw new Error('No se encontro el pedido local asociado al envio.');
      const remoteOrder = await getOrder(linkedExternalOrderId, integration?.userId || null);
      const result = await importMeliOrder(
        { ...remoteOrder, shipping: shipment },
        { userId: integration?.userId || null, notifyStaff: false }
      );
      await writeMeliImportLog({
        status: 'SENT',
        externalOrderId: linkedExternalOrderId,
        order: result.order,
        orderNumber: result.order?.orderNumber,
        message: `Envio Mercado Libre ${externalOrderId} actualizado automaticamente.`,
        details: { notification, shipmentId: externalOrderId },
      });
      return;
    } catch (error) {
      logger.warn(`[Meli Webhook] No se pudo actualizar envio ${externalOrderId}: ${error.message}`);
    }
  }

  if (isOrderNotification) {
    try {
      const integration = await getIntegrationByMeliUserId(notification.user_id);
      const meliOrder = await getOrder(externalOrderId, integration?.userId || null);

      if (!meliOrder) {
        throw new Error('No se pudo leer el detalle de la orden en Mercado Libre.');
      }

      const enrichedOrder = await enrichMeliOrderWithShipment(
        meliOrder,
        integration?.userId || null
      );
      const result = await importMeliOrder(enrichedOrder, {
        userId: integration?.userId || null,
        notifyStaff: true,
      });

      await writeMeliImportLog({
        status: 'SENT',
        externalOrderId,
        order: result.order,
        orderNumber: result.order?.orderNumber || `${MELI_ORDER_PREFIX}-${externalOrderId}`,
        message: `Webhook Mercado Libre procesado: ${result.action}.`,
        details: { notification, result },
      });
      return;
    } catch (error) {
      logger.warn(`[Meli Webhook] No se pudo importar orden ${externalOrderId}:`, error.message);
      await writeMeliImportLog({
        status: 'FAILED',
        externalOrderId,
        orderNumber: `${MELI_ORDER_PREFIX}-${externalOrderId}`,
        message: 'Webhook Mercado Libre recibido, pero no se pudo importar la orden.',
        error: error.message,
        details: { notification },
      });
    }
  }

  await prisma.externalOrder.upsert({
    where: {
      channel_externalOrderId: {
        channel: MELI_CHANNEL,
        externalOrderId,
      },
    },
    update: {
      externalStatus: notification.topic,
      rawData: notification,
    },
    create: {
      channel: MELI_CHANNEL,
      externalOrderId,
      externalStatus: notification.topic,
      rawData: notification,
    },
  }).catch((error) => {
    logger.warn('[Meli Webhook] No se pudo guardar evento como orden externa:', error.message);
  });
};

const listWebhookEvents = async ({ limit = 20 } = {}) => listNotificationLogs({
  provider: 'mercadolibre',
  limit,
});

export {
  assertMeliConfig,
  getIntegrationStatus,
  getValidAccessToken,
  exchangeCodeForToken,
  processWebhookNotification,
  listWebhookEvents,
  getMeliSellerId,
  fetchMeliOrders,
  syncMeliOrders,
  importMeliOrder,
  getOrder,
  getShipment,
  getShipmentLabel,
  getMeliDispatchDetails,
  enrichMeliOrderWithShipment,
  getItem,
  searchSellerItemsBySku,
  predictCategory,
  predictCategories,
  getCategory,
  getCategoryAttributes,
  searchCatalogProducts,
  getCatalogProduct,
  getShippingPreferences,
  getSellerProfile,
  getDefaultShippingContext,
  getListingPriceQuote,
  getShippingCostQuote,
  quotePublicationCosts,
  estimatePublicationCostsAtPrice,
  uploadPictureFromUrl,
  updateItemPictures,
  validateItem,
  createItem,
  createItemDescription,
  updateStock,
  updatePriceAndStock,
  syncMeliClaims,
  syncMeliClaimById,
  sendMeliClaimMessage,
  executeMeliClaimAction,
  getClaimDueDate,
};
