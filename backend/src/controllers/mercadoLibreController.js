import asyncHandler from 'express-async-handler';
import * as mercadoLibreService from '../services/mercadoLibreService.js';
import { getConfig } from '../services/configService.js';
import { generateRandomString, generateCodeChallenge } from '../utils/pkce.js';
import logger from '../utils/logger.js';
import prisma from '../config/prisma.js';
import {
  getPublishableStock,
  syncMercadoLibreListingStock,
} from '../services/channelStockSyncService.js';
import {
  normalizeMercadoLibreId,
  isMercadoLibreItemId,
  isRequiredMercadoLibreAttribute,
  isConditionalMercadoLibreAttribute,
} from '../utils/mercadoLibreIdentifiers.js';
import { BadRequestError, NotFoundError } from '../utils/errorUtils.js';
import { emitRealtimeMany } from '../services/realtimeService.js';

const oauthStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

const cleanupExpiredStates = () => {
  const now = Date.now();
  for (const [state, value] of oauthStates.entries()) {
    if (now - value.createdAt > STATE_TTL_MS) oauthStates.delete(state);
  }
};

const getClientRedirectUrl = (path, params = {}) => {
  const config = getConfig();
  const base = config.CLIENT_URL_PRIMARY || 'https://tecnotitlan.com.mx';
  const url = new URL(path, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const buildMeliAuthUrl = async (userId) => {
  const config = mercadoLibreService.assertMeliConfig();
  cleanupExpiredStates();

  const verifier = generateRandomString(96);
  const challenge = await generateCodeChallenge(verifier);
  const state = generateRandomString(48);
  oauthStates.set(state, { userId, verifier, createdAt: Date.now() });

  const authUrl = new URL('https://auth.mercadolibre.com.mx/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.MERCADOLIBRE_APP_ID);
  authUrl.searchParams.set('redirect_uri', config.MERCADOLIBRE_REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return authUrl.toString();
};

const getStatus = asyncHandler(async (req, res) => {
  const status = await mercadoLibreService.getIntegrationStatus(req.user.id);
  const config = getConfig();

  res.json({
    status: 'success',
    data: {
      ...status,
      redirectUri: config.MERCADOLIBRE_REDIRECT_URI || 'https://api.tecnotitlan.com.mx/api/mercadolibre/callback',
      notificationsUrl: `${config.API_PUBLIC_URL || 'https://api.tecnotitlan.com.mx'}/api/mercadolibre/notifications`,
      isConfigured: Boolean(config.MERCADOLIBRE_APP_ID && config.MERCADOLIBRE_CLIENT_SECRET && config.MERCADOLIBRE_REDIRECT_URI),
    },
  });
});

const getMeliAuthUrl = asyncHandler(async (req, res) => {
  const authUrl = await buildMeliAuthUrl(req.user.id);
  res.json({ status: 'success', data: { authUrl } });
});

const handleMeliAuth = asyncHandler(async (req, res) => {
  const authUrl = await buildMeliAuthUrl(req.user.id);
  res.redirect(authUrl);
});

const handleMeliCallback = asyncHandler(async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.redirect(getClientRedirectUrl('/admin/settings/mercadolibre', {
      connected: '0',
      error: errorDescription || error,
    }));
  }

  const stateRecord = oauthStates.get(String(state || ''));
  oauthStates.delete(String(state || ''));

  if (!code || !stateRecord) {
    return res.redirect(getClientRedirectUrl('/admin/settings/mercadolibre', {
      connected: '0',
      error: 'Autorizacion expirada. Intenta conectar Mercado Libre de nuevo.',
    }));
  }

  try {
    await mercadoLibreService.exchangeCodeForToken(String(code), stateRecord.verifier, stateRecord.userId);
    return res.redirect(getClientRedirectUrl('/admin/settings/mercadolibre', { connected: '1' }));
  } catch (exchangeError) {
    logger.error('[Meli Callback] Error conectando Mercado Libre:', exchangeError.message);
    return res.redirect(getClientRedirectUrl('/admin/settings/mercadolibre', {
      connected: '0',
      error: exchangeError.message,
    }));
  }
});

const exchangeCodeForToken = asyncHandler(async (req, res) => {
  const { code, codeVerifier } = req.body;

  if (!code) {
    res.status(400);
    throw new Error('Falta el codigo de autorizacion.');
  }

  const integration = await mercadoLibreService.exchangeCodeForToken(code, codeVerifier, req.user.id);
  res.status(200).json({ status: 'success', message: 'Mercado Libre conectado.', data: integration });
});

const handleWebhookNotification = asyncHandler(async (req, res) => {
  const notification = req.body;
  logger.info(`[Meli Webhook] Notificacion recibida: ${JSON.stringify(notification)}`);

  res.status(200).send('OK');

  mercadoLibreService.processWebhookNotification(notification)
    .then(() => {
      emitRealtimeMany(
        ['meli', 'marketplaces', 'orders', 'inventory', 'products', 'inbox', 'returns', 'dashboard'],
        'meli.webhook.processed',
      );
      emitRealtimeMany(['orders', 'products'], 'marketplace.updated', {}, { room: 'authenticated' });
      emitRealtimeMany(['products', 'catalog'], 'catalog.updated', {}, { room: 'public' });
    })
    .catch((error) => {
      logger.error('[Meli Webhook] Error procesando notificacion:', error.message);
    });
});

const getMeliOrders = asyncHandler(async (req, res) => {
  const result = await mercadoLibreService.syncMeliOrders(req.user.id);
  emitRealtimeMany(['meli', 'orders', 'inventory', 'products', 'dashboard'], 'meli.orders.synchronized');

  res.status(200).json({
    status: 'success',
    data: {
      count: result.count,
      orders: result.orders,
      imports: result.imports,
    },
  });
});

const getWebhookEvents = asyncHandler(async (req, res) => {
  const events = await mercadoLibreService.listWebhookEvents({ limit: req.query.limit || 20 });

  res.status(200).json({
    status: 'success',
    data: events,
  });
});

const getMeliItemDetails = asyncHandler(async (req, res) => {
  const { meliItemId } = req.params;
  const normalizedMeliItemId = normalizeMercadoLibreId(meliItemId);
  if (!isMercadoLibreItemId(normalizedMeliItemId)) {
    res.status(400);
    throw new Error(
      `${normalizedMeliItemId || 'El valor recibido'} no es un ID de publicacion. Las categorias como MLM126793 no se validan como anuncios.`,
    );
  }

  const itemDetails = await mercadoLibreService.getItem(req.user.id, normalizedMeliItemId);

  if (!itemDetails) {
    res.status(404);
    throw new Error('No se encontro el articulo en Mercado Libre o no tienes acceso.');
  }

  const localProduct = await prisma.product.findUnique({
    where: { meliItemId: normalizedMeliItemId },
    select: {
      price: true,
      weightKg: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
    },
  });
  let currentCostEstimate = null;
  let recommendedQuote = null;
  if (localProduct && itemDetails.category_id && itemDetails.listing_type_id) {
    [currentCostEstimate, recommendedQuote] = await Promise.all([
      mercadoLibreService.estimatePublicationCostsAtPrice(req.user.id, {
        price: itemDetails.price,
        categoryId: itemDetails.category_id,
        listingTypeId: itemDetails.listing_type_id,
        condition: itemDetails.condition || 'new',
        weightKg: localProduct.weightKg,
        lengthCm: localProduct.lengthCm,
        widthCm: localProduct.widthCm,
        heightCm: localProduct.heightCm,
        itemId: normalizedMeliItemId,
      }),
      mercadoLibreService.quotePublicationCosts(req.user.id, {
        targetNet: localProduct.price,
        categoryId: itemDetails.category_id,
        listingTypeId: itemDetails.listing_type_id,
        condition: itemDetails.condition || 'new',
        weightKg: localProduct.weightKg,
        lengthCm: localProduct.lengthCm,
        widthCm: localProduct.widthCm,
        heightCm: localProduct.heightCm,
        itemId: normalizedMeliItemId,
      }),
    ]);
  }

  res.status(200).json({
    status: 'success',
    data: {
      ...itemDetails,
      tecnotitlanCostEstimate: currentCostEstimate,
      tecnotitlanRecommendedQuote: recommendedQuote,
    },
  });
});

const getPublicationRequirements = asyncHandler(async (req, res) => {
  const title = String(req.query.title || '').trim();
  // El editor admin navega con el SKU, mientras que algunas llamadas internas
  // usan el UUID. Aceptamos ambos para que preparar una publicacion no dependa
  // de como se abrio la ficha del producto.
  const productReference = String(req.query.productId || '').trim();
  let categoryId = String(req.query.categoryId || '').trim();
  let predictions = [];
  let inventory = null;
  let localProduct = null;

  if (productReference) {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: productReference },
          { sku: productReference.toUpperCase() },
        ],
      },
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        gtin: true,
        price: true,
        weightKg: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        characteristics: {
          select: { key: true, value: true },
        },
        countInStock: true,
        marketplaceListings: {
          where: { channel: 'MERCADOLIBRE' },
          take: 1,
          select: {
            publishedStock: true,
            stockBuffer: true,
          },
        },
      },
    });

    if (!product) {
      res.status(404);
      throw new Error('Producto local no encontrado.');
    }

    const listing = product.marketplaceListings[0] || null;
    localProduct = product;
    inventory = {
      warehouseStock: Number(product.countInStock || 0),
      assignedStock: Number(listing?.publishedStock || 0),
      stockBuffer: Number(listing?.stockBuffer || 0),
      publishableStock: getPublishableStock(listing),
    };
  }

  if (title) {
    predictions = await mercadoLibreService.predictCategories(req.user.id, title, 3);
  }

  if (!categoryId) {
    categoryId = predictions[0]?.category_id || '';
  }

  if (!categoryId) {
    res.status(422);
    throw new Error('Mercado Libre no pudo sugerir una categoria. Capturala manualmente.');
  }

  const [attributes, selectedCategory] = await Promise.all([
    mercadoLibreService.getCategoryAttributes(req.user.id, categoryId),
    mercadoLibreService.getCategory(req.user.id, categoryId),
  ]);
  const categorySuggestions = await Promise.all(predictions.map(async (prediction) => {
    const detail = prediction.category_id === categoryId
      ? selectedCategory
      : await mercadoLibreService.getCategory(req.user.id, prediction.category_id);
    return {
      id: prediction.category_id,
      name: prediction.category_name || detail?.name || prediction.category_id,
      domainId: prediction.domain_id || null,
      domainName: prediction.domain_name || null,
      path: Array.isArray(detail?.path_from_root)
        ? detail.path_from_root.map((item) => item.name).filter(Boolean)
        : [],
      isLeaf: !Array.isArray(detail?.children_categories) || detail.children_categories.length === 0,
    };
  }));
  const selectedDomainId = predictions.find(
    (item) => item.category_id === categoryId
  )?.domain_id || null;
  const [existingSellerItems, catalogResults] = localProduct
    ? await Promise.all([
      mercadoLibreService.searchSellerItemsBySku(req.user.id, localProduct.sku),
      mercadoLibreService.searchCatalogProducts(req.user.id, {
        gtin: localProduct.gtin,
        query: [localProduct.brand, localProduct.name].filter(Boolean).join(' '),
        domainId: selectedDomainId,
        limit: 5,
      }),
    ])
    : [[], []];
  const existingListings = existingSellerItems.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    categoryId: item.category_id,
    catalogProductId: item.catalog_product_id || null,
    permalink: item.permalink || null,
    availableQuantity: Number(item.available_quantity || 0),
  }));
  const normalizeCatalogText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const localCatalogText = normalizeCatalogText([
    localProduct?.brand,
    localProduct?.name,
    ...(localProduct?.characteristics || [])
      .filter((item) => /modelo|model|color|linea|version|variante/i.test(item.key || ''))
      .flatMap((item) => [item.key, item.value]),
  ].filter(Boolean).join(' '));
  const localTokens = new Set(localCatalogText.split(' ').filter((token) => token.length > 1));
  const catalogProducts = catalogResults
    .map((catalogProduct, originalIndex) => {
      const name = catalogProduct.name || catalogProduct.title || catalogProduct.id;
      const candidateText = normalizeCatalogText([
        name,
        ...(catalogProduct.attributes || []).flatMap((attribute) => [
          attribute.name,
          attribute.value_name,
        ]),
      ].filter(Boolean).join(' '));
      const matchingTokens = [...localTokens].filter((token) => candidateText.includes(token));
      const textConfidence = localTokens.size > 0
        ? Math.round((matchingTokens.length / localTokens.size) * 100)
        : 0;
      const brandMatch = localProduct?.brand
        && candidateText.includes(normalizeCatalogText(localProduct.brand));
      return {
        id: catalogProduct.id,
        name,
        status: catalogProduct.status || null,
        domainId: catalogProduct.domain_id || null,
        categoryId: catalogProduct.category_id || null,
        childrenIds: Array.isArray(catalogProduct.children_ids) ? catalogProduct.children_ids : [],
        picture: catalogProduct.pictures?.[0]?.url || catalogProduct.thumbnail || null,
        matchedBy: localProduct?.gtin ? 'GTIN' : 'TITLE',
        confidence: localProduct?.gtin ? 100 : Math.min(textConfidence + (brandMatch ? 10 : 0), 99),
        originalIndex,
      };
    })
    .sort((left, right) => right.confidence - left.confidence || left.originalIndex - right.originalIndex)
    .map(({ originalIndex, ...catalogProduct }, index) => ({
      ...catalogProduct,
      recommended: index === 0,
    }));
  const publicationQuotes = localProduct
    ? await Promise.all(['gold_special', 'gold_pro'].map((listingTypeId) =>
      mercadoLibreService.quotePublicationCosts(req.user.id, {
        targetNet: localProduct.price,
        categoryId,
        listingTypeId,
        condition: String(req.query.condition || 'new'),
        weightKg: localProduct.weightKg,
        lengthCm: localProduct.lengthCm,
        widthCm: localProduct.widthCm,
        heightCm: localProduct.heightCm,
      })
    ))
    : [];
  const editableAttributes = attributes
    .filter((attribute) => {
      const tags = attribute?.tags || {};
      return Boolean(
        isRequiredMercadoLibreAttribute(attribute)
        || isConditionalMercadoLibreAttribute(attribute)
        || tags.recommended
      );
    })
    .map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      valueType: attribute.value_type,
      required: isRequiredMercadoLibreAttribute(attribute),
      conditionalRequired: isConditionalMercadoLibreAttribute(attribute),
      allowCustomValue: attribute.id === 'BRAND' && attribute.value_type === 'string',
      hint: attribute.hint || '',
      valueMaxLength: Number(attribute.value_max_length) || null,
      values: Array.isArray(attribute.values)
        ? attribute.values.slice(0, 100).map((value) => ({
          id: value.id,
          name: value.name,
        }))
        : [],
    }));

  res.status(200).json({
    status: 'success',
    data: {
      categoryId,
      categoryName: selectedCategory?.name || null,
      categoryPath: Array.isArray(selectedCategory?.path_from_root)
        ? selectedCategory.path_from_root.map((item) => item.name).filter(Boolean)
        : [],
      isLeafCategory: !Array.isArray(selectedCategory?.children_categories)
        || selectedCategory.children_categories.length === 0,
      domainName: predictions.find((item) => item.category_id === categoryId)?.domain_name || null,
      categorySuggestions,
      existingListings,
      catalogProducts,
      catalogRecommendedId: catalogProducts[0]?.id || null,
      catalogMatchExact: Boolean(localProduct?.gtin && catalogProducts.length === 1),
      publicationQuotes,
      attributes: editableAttributes,
      inventory,
    },
  });
});

const syncStock = asyncHandler(async (req, res) => {
  const { sku } = req.params;
  const product = await prisma.product.findUnique({
    where: { sku },
    include: {
      marketplaceListings: {
        where: { channel: 'MERCADOLIBRE' },
        take: 1,
      },
    },
  });

  if (!product) {
    res.status(404);
    throw new Error('Producto local no encontrado.');
  }

  if (!product.meliItemId) {
    res.status(400);
    throw new Error('Este producto no esta vinculado a una publicacion de Mercado Libre.');
  }
  if (req.body?.confirmCosts !== true) {
    res.status(400);
    throw new Error('Revisa y confirma la cotizacion de Mercado Libre antes de sincronizar.');
  }

  const listing = product.marketplaceListings?.[0] || null;
  const remoteItem = await mercadoLibreService.getItem(req.user.id, product.meliItemId);
  if (!remoteItem?.category_id || !remoteItem?.listing_type_id) {
    res.status(400);
    throw new Error('No se pudo leer la categoria o modalidad de la publicacion vinculada.');
  }
  const pricing = await mercadoLibreService.quotePublicationCosts(req.user.id, {
    targetNet: product.price,
    categoryId: remoteItem.category_id,
    listingTypeId: remoteItem.listing_type_id,
    condition: remoteItem.condition || 'new',
    weightKg: product.weightKg,
    lengthCm: product.lengthCm,
    widthCm: product.widthCm,
    heightCm: product.heightCm,
  });
  const syncResult = await syncMercadoLibreListingStock({
    userId: req.user.id,
    product,
    listing,
    confirmedPrice: pricing.recommendedPrice,
  });

  if (syncResult.status !== 'synced') {
    res.status(400);
    throw new Error(syncResult.reason || 'No se pudo sincronizar Mercado Libre.');
  }

  logger.info(`[Meli Sync] Stock ${sku} -> ${syncResult.stock} en Mercado Libre`);
  res.status(200).json({
    status: 'success',
    message: syncResult.message,
    data: { sync: syncResult, pricing },
  });
});

const getMeliClaims = asyncHandler(async (req, res) => {
  const { status, internalStatus, priority } = req.query;
  const claims = await prisma.meliClaim.findMany({
    where: {
      ...(status ? { status: String(status) } : {}),
      ...(internalStatus ? { internalStatus: String(internalStatus) } : {}),
      ...(priority ? { priority: String(priority) } : {}),
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalPrice: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      activities: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
  });
  res.json({ status: 'success', data: { claims } });
});

const syncMeliClaims = asyncHandler(async (req, res) => {
  const result = await mercadoLibreService.syncMeliClaims(req.user.id);
  res.json({
    status: 'success',
    message: `${result.count} reclamo(s) sincronizado(s) desde Mercado Libre.`,
    data: result,
  });
});

const refreshMeliClaim = asyncHandler(async (req, res) => {
  const claim = await mercadoLibreService.syncMeliClaimById(req.user.id, req.params.claimId);
  await prisma.meliClaimActivity.create({
    data: {
      claimId: claim.id,
      action: 'MANUAL_SYNC',
      actorId: req.user.id,
      actorName: req.user.email,
    },
  });
  res.json({ status: 'success', data: { claim } });
});

const updateMeliClaim = asyncHandler(async (req, res) => {
  const validStatuses = ['PENDING_REVIEW', 'IN_PROGRESS', 'WAITING_BUYER', 'WAITING_MELI', 'INSPECTION', 'RESOLVED'];
  const validInspection = ['NOT_RECEIVED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTING', 'SELLABLE', 'DAMAGED', 'INCOMPLETE'];
  const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  const current = await prisma.meliClaim.findUnique({ where: { externalClaimId: req.params.claimId } });
  if (!current) throw new NotFoundError('Reclamo no encontrado.');
  const { internalStatus, inspectionStatus, inspectionNotes, priority, assignedTo } = req.body;
  if (internalStatus && !validStatuses.includes(internalStatus)) throw new BadRequestError('Estado interno invalido.');
  if (inspectionStatus && !validInspection.includes(inspectionStatus)) throw new BadRequestError('Estado de inspeccion invalido.');
  if (priority && !validPriorities.includes(priority)) throw new BadRequestError('Prioridad invalida.');
  const claim = await prisma.$transaction(async (tx) => {
    const updated = await tx.meliClaim.update({
      where: { id: current.id },
      data: {
        ...(internalStatus ? { internalStatus } : {}),
        ...(inspectionStatus ? { inspectionStatus } : {}),
        ...(inspectionNotes !== undefined ? { inspectionNotes: String(inspectionNotes || '').slice(0, 5000) || null } : {}),
        ...(priority ? { priority } : {}),
        ...(assignedTo !== undefined ? { assignedTo: String(assignedTo || '').slice(0, 160) || null } : {}),
      },
      include: { order: true, activities: { orderBy: { createdAt: 'desc' }, take: 30 } },
    });
    await tx.meliClaimActivity.create({
      data: {
        claimId: current.id,
        action: 'INTERNAL_UPDATE',
        actorId: req.user.id,
        actorName: req.user.email,
        details: { internalStatus, inspectionStatus, priority, assignedTo },
      },
    });
    return updated;
  });
  res.json({ status: 'success', data: { claim } });
});

const sendMeliClaimMessage = asyncHandler(async (req, res) => {
  const receiverRole = req.body.receiverRole;
  if (!['complainant', 'mediator'].includes(receiverRole)) throw new BadRequestError('Destinatario invalido.');
  const claim = await mercadoLibreService.sendMeliClaimMessage(req.user.id, req.params.claimId, {
    message: String(req.body.message || '').slice(0, 3500),
    receiverRole,
  });
  await prisma.meliClaimActivity.create({
    data: {
      claimId: claim.id,
      action: 'MESSAGE_SENT',
      actorId: req.user.id,
      actorName: req.user.email,
      details: { receiverRole },
    },
  });
  res.status(201).json({ status: 'success', message: 'Mensaje enviado por Mercado Libre.', data: { claim } });
});

const executeMeliClaimAction = asyncHandler(async (req, res) => {
  const { action, confirmation } = req.body;
  if (String(confirmation || '') !== String(req.params.claimId)) {
    throw new BadRequestError('Confirma la accion escribiendo el folio exacto del reclamo.');
  }
  const current = await prisma.meliClaim.findUnique({ where: { externalClaimId: req.params.claimId } });
  if (!current) throw new NotFoundError('Reclamo no encontrado.');
  const requested = await prisma.meliClaimActivity.create({
    data: {
      claimId: current.id,
      action: `MELI_ACTION_REQUESTED:${action}`,
      actorId: req.user.id,
      actorName: req.user.email,
      details: { confirmedWithClaimId: true },
    },
  });
  try {
    const claim = await mercadoLibreService.executeMeliClaimAction(req.user.id, req.params.claimId, action);
    await prisma.meliClaimActivity.create({
      data: { claimId: current.id, action: `MELI_ACTION_APPLIED:${action}`, actorId: req.user.id, actorName: req.user.email },
    });
    res.json({ status: 'success', message: 'Accion aplicada y reclamo actualizado.', data: { claim } });
  } catch (error) {
    await prisma.meliClaimActivity.create({
      data: {
        claimId: current.id,
        action: `MELI_ACTION_FAILED:${action}`,
        actorId: req.user.id,
        actorName: req.user.email,
        details: { requestActivityId: requested.id, error: String(error.message || error).slice(0, 1000) },
      },
    });
    throw error;
  }
});

const getMeliCommunications = asyncHandler(async (req, res) => {
  const [questions, conversations, activities] = await Promise.all([
    prisma.meliQuestion.findMany({
      include: { product: { select: { id: true, sku: true, name: true, meliItemId: true, meliPublicationUrl: true } } },
      orderBy: [{ askedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    prisma.meliPostSaleConversation.findMany({
      include: {
        order: { select: { id: true, orderNumber: true, status: true, totalPrice: true } },
        messages: { orderBy: { sentAt: 'asc' } },
      },
      orderBy: [{ unreadCount: 'desc' }, { lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    }),
    prisma.meliCommunicationActivity.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);
  res.json({ status: 'success', data: { questions, conversations, activities } });
});

const getMeliCommunicationCounts = asyncHandler(async (req, res) => {
  const [unansweredQuestions, unreadMessages] = await Promise.all([
    prisma.meliQuestion.count({ where: { status: 'UNANSWERED' } }),
    prisma.meliPostSaleConversation.aggregate({ _sum: { unreadCount: true } }),
  ]);
  const unread = Number(unreadMessages._sum.unreadCount || 0);
  res.json({ status: 'success', data: { unansweredQuestions, unreadMessages: unread, total: unansweredQuestions + unread } });
});

const syncMeliCommunications = asyncHandler(async (req, res) => {
  const [questions, conversations] = await Promise.all([
    mercadoLibreService.syncMeliQuestions(req.user.id),
    mercadoLibreService.syncMeliPostSaleConversations(req.user.id),
  ]);
  res.json({
    status: 'success',
    message: 'Preguntas y mensajes sincronizados con Mercado Libre.',
    data: { questions, conversations },
  });
});

const answerMeliQuestion = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) throw new BadRequestError('Escribe una respuesta antes de enviarla.');
  if (text.length > 2000) throw new BadRequestError('La respuesta no puede superar 2000 caracteres.');
  const question = await mercadoLibreService.answerMeliQuestion(req.user.id, req.params.questionId, text);
  await prisma.meliCommunicationActivity.create({
    data: {
      entityType: 'QUESTION', externalId: req.params.questionId, action: 'ANSWER_SENT',
      actorId: req.user.id, actorName: req.user.email,
    },
  });
  res.status(201).json({ status: 'success', message: 'Respuesta publicada en Mercado Libre.', data: { question } });
});

const sendMeliPostSaleMessage = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) throw new BadRequestError('Escribe un mensaje antes de enviarlo.');
  const conversation = await mercadoLibreService.sendMeliPostSaleMessage(req.user.id, req.params.packId, text);
  await prisma.meliCommunicationActivity.create({
    data: {
      entityType: 'POST_SALE', externalId: req.params.packId, action: 'MESSAGE_SENT',
      actorId: req.user.id, actorName: req.user.email,
    },
  });
  res.status(201).json({ status: 'success', message: 'Mensaje enviado por Mercado Libre.', data: { conversation } });
});

const markMeliPostSaleRead = asyncHandler(async (req, res) => {
  const conversation = await mercadoLibreService.syncMeliPostSaleConversation(req.user.id, req.params.packId, {
    markAsRead: true,
    persistEmpty: true,
  });
  await prisma.meliCommunicationActivity.create({
    data: {
      entityType: 'POST_SALE', externalId: req.params.packId, action: 'MARKED_READ',
      actorId: req.user.id, actorName: req.user.email,
    },
  });
  res.json({ status: 'success', data: { conversation } });
});

const updateMeliCommunication = asyncHandler(async (req, res) => {
  const { type, externalId } = req.params;
  const { assignedTo, internalStatus } = req.body;
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED'];
  if (internalStatus && !validStatuses.includes(internalStatus)) throw new BadRequestError('Estado interno invalido.');
  const data = {
    ...(assignedTo !== undefined ? { assignedTo: String(assignedTo || '').slice(0, 160) || null } : {}),
    ...(internalStatus ? { internalStatus } : {}),
  };
  let entity;
  if (type === 'question') entity = await prisma.meliQuestion.update({ where: { externalQuestionId: externalId }, data });
  else if (type === 'post-sale') entity = await prisma.meliPostSaleConversation.update({ where: { packId: externalId }, data });
  else throw new BadRequestError('Tipo de comunicacion invalido.');
  await prisma.meliCommunicationActivity.create({
    data: {
      entityType: type === 'question' ? 'QUESTION' : 'POST_SALE', externalId, action: 'INTERNAL_UPDATE',
      actorId: req.user.id, actorName: req.user.email, details: { assignedTo, internalStatus },
    },
  });
  res.json({ status: 'success', data: { entity } });
});

const disconnectMeli = asyncHandler(async (req, res) => {
  const integration = await prisma.meliIntegration.findFirst({ where: { userId: req.user.id } });

  if (!integration) {
    res.status(404);
    throw new Error('No se encontro una integracion de Mercado Libre para desconectar.');
  }

  await prisma.meliIntegration.delete({ where: { id: integration.id } });
  logger.info(`[Meli] Integracion desconectada para usuario ${req.user.id}`);

  res.status(200).json({ status: 'success', message: 'Mercado Libre desconectado.' });
});

export {
  getStatus,
  getMeliAuthUrl,
  handleMeliAuth,
  handleMeliCallback,
  exchangeCodeForToken,
  handleWebhookNotification,
  getWebhookEvents,
  getMeliOrders,
  disconnectMeli,
  getMeliItemDetails,
  getPublicationRequirements,
  syncStock,
  getMeliClaims,
  syncMeliClaims,
  refreshMeliClaim,
  updateMeliClaim,
  sendMeliClaimMessage,
  executeMeliClaimAction,
  getMeliCommunications,
  getMeliCommunicationCounts,
  syncMeliCommunications,
  answerMeliQuestion,
  sendMeliPostSaleMessage,
  markMeliPostSaleRead,
  updateMeliCommunication,
};
