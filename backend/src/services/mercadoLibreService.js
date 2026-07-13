import axios from 'axios';
import { URLSearchParams } from 'url';
import logger from '../utils/logger.js';
import { getConfig } from './configService.js';
import prisma from '../config/prisma.js';

const MELI_API_BASE_URL = 'https://api.mercadolibre.com';

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

const processWebhookNotification = async (notification) => {
  logger.info(`[Meli Webhook] Evento recibido topic=${notification?.topic || 'sin-topic'} resource=${notification?.resource || 'sin-resource'}`);

  if (!notification?.topic || !notification?.resource) return;

  await prisma.externalOrder.upsert({
    where: {
      channel_externalOrderId: {
        channel: 'MERCADOLIBRE',
        externalOrderId: String(notification.resource),
      },
    },
    update: {
      externalStatus: notification.topic,
      rawData: notification,
    },
    create: {
      channel: 'MERCADOLIBRE',
      externalOrderId: String(notification.resource),
      externalStatus: notification.topic,
      rawData: notification,
    },
  }).catch((error) => {
    logger.warn('[Meli Webhook] No se pudo guardar evento como orden externa:', error.message);
  });
};

export {
  assertMeliConfig,
  getIntegrationStatus,
  getValidAccessToken,
  exchangeCodeForToken,
  processWebhookNotification,
  getMeliSellerId,
  fetchMeliOrders,
  getOrder,
  getItem,
  updateStock,
};
