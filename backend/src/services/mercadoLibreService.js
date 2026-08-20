import axios from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
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
  const address = order.shipping?.receiver_address || {};
  return {
    source: 'mercadolibre',
    receiverName: address.receiver_name || getMeliCustomerName(order),
    phone: getMeliPhone(order),
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
    return {
      action: 'existing',
      externalOrderId,
      order: existingExternalOrder.order,
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
        shippingInfo: {
          provider: 'mercadolibre',
          shippingId: meliOrder.shipping?.id || null,
          status: meliOrder.shipping?.status || null,
          trackingNumber: meliOrder.shipping?.tracking_number || null,
          raw: meliOrder.shipping || null,
        },
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

      imports.push(await importMeliOrder(orderDetail || order, {
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

const getMeliErrorMessage = (error, fallback) => {
  const apiMessage = error?.response?.data?.message;
  const apiCause = error?.response?.data?.cause;
  const causeMessages = Array.isArray(apiCause)
    ? apiCause.map((cause) => [cause?.code, cause?.message].filter(Boolean).join(': '))
    : [];
  const details = [apiMessage, ...causeMessages].filter(Boolean);

  if (details.length > 0) {
    return [...new Set(details)].join('; ');
  }

  return error?.message || fallback;
};

const predictCategory = async (userId, title) => {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No hay token valido de Mercado Libre.');
  }

  try {
    const { data } = await axios.get(
      `${MELI_API_BASE_URL}/sites/MLM/domain_discovery/search`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { q: title, limit: 1 },
      }
    );
    return Array.isArray(data) ? data[0] || null : null;
  } catch (error) {
    logger.error(`[MercadoLibre] No se pudo predecir categoria: ${error.message}`);
    throw new Error(getMeliErrorMessage(error, 'No se pudo sugerir una categoria de Mercado Libre.'));
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

  if (isOrderNotification) {
    try {
      const integration = await getIntegrationByMeliUserId(notification.user_id);
      const meliOrder = await getOrder(externalOrderId, integration?.userId || null);

      if (!meliOrder) {
        throw new Error('No se pudo leer el detalle de la orden en Mercado Libre.');
      }

      const result = await importMeliOrder(meliOrder, {
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
  getItem,
  predictCategory,
  getCategoryAttributes,
  createItem,
  createItemDescription,
  updateStock,
};
