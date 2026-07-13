import asyncHandler from 'express-async-handler';
import * as mercadoLibreService from '../services/mercadoLibreService.js';
import { getConfig } from '../services/configService.js';
import { generateRandomString, generateCodeChallenge } from '../utils/pkce.js';
import logger from '../utils/logger.js';
import prisma from '../config/prisma.js';

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

  mercadoLibreService.processWebhookNotification(notification).catch((error) => {
    logger.error('[Meli Webhook] Error procesando notificacion:', error.message);
  });
});

const getMeliOrders = asyncHandler(async (req, res) => {
  const meliSellerId = await mercadoLibreService.getMeliSellerId();

  if (!meliSellerId) {
    res.status(404);
    throw new Error('No se ha conectado Mercado Libre.');
  }

  const orders = await mercadoLibreService.fetchMeliOrders(meliSellerId, req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      count: orders.length,
      orders,
    },
  });
});

const getMeliItemDetails = asyncHandler(async (req, res) => {
  const { meliItemId } = req.params;
  const itemDetails = await mercadoLibreService.getItem(req.user.id, meliItemId);

  if (!itemDetails) {
    res.status(404);
    throw new Error('No se encontro el articulo en Mercado Libre o no tienes acceso.');
  }

  res.status(200).json({ status: 'success', data: itemDetails });
});

const syncStock = asyncHandler(async (req, res) => {
  const { sku } = req.params;
  const product = await prisma.product.findUnique({ where: { sku } });

  if (!product) {
    res.status(404);
    throw new Error('Producto local no encontrado.');
  }

  if (!product.meliItemId) {
    res.status(400);
    throw new Error('Este producto no esta vinculado a una publicacion de Mercado Libre.');
  }

  await mercadoLibreService.updateStock(req.user.id, product.meliItemId, product.countInStock);

  await prisma.product.update({
    where: { id: product.id },
    data: { lastMeliSync: new Date() },
  });

  logger.info(`[Meli Sync] Stock ${sku} -> ${product.countInStock} en Mercado Libre`);
  res.status(200).json({ status: 'success', message: `Stock actualizado a ${product.countInStock} en Mercado Libre.` });
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
  getMeliOrders,
  disconnectMeli,
  getMeliItemDetails,
  syncStock,
};
