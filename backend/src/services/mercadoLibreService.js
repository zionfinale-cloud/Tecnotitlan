import axios from 'axios';
import { URLSearchParams } from 'url';
import logger from '../utils/logger.js';
import { getConfig } from './configService.js';
import prisma from '../config/prisma.js';


/**
 * Refresca un access token de Mercado Libre que ha expirado.
 * @param {object} integration - El documento de integración de Meli de la base de datos.
 * @returns {Promise<string>} - El nuevo access token.
 */
const refreshAccessToken = async (integration) => {
  logger.info(`[Meli Service] Refrescando token para el usuario: ${integration.user}`);
  const config = getConfig();

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', config.MERCADOLIBRE_APP_ID);
  params.append('client_secret', config.MERCADOLIBRE_CLIENT_SECRET);
  params.append('refresh_token', integration.refreshToken);

  try {
    const { data } = await axios.post('https://api.mercadolibre.com/oauth/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    const updatedIntegration = await prisma.meliIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    logger.success(`[Meli Service] Token refrescado exitosamente para el usuario: ${integration.user}`);
    return updatedIntegration.accessToken;
  } catch (error) {
    logger.error('[Meli Service] Error al refrescar el token de Mercado Libre:', error.response?.data || error.message);
    throw new Error('No se pudo refrescar el token de Mercado Libre. Por favor, reconecta tu cuenta.');
  }
};

/**
 * Obtiene un access token válido, refrescándolo si es necesario.
 * @param {string} [userId] - El ID del usuario. Si se omite, busca la primera integración.
 * @returns {Promise<string|null>} - El access token válido o null.
 */
const getValidAccessToken = async (userId = null) => {
  const whereClause = userId ? { userId: userId } : {};
  const integration = await prisma.meliIntegration.findFirst({ where: whereClause });

  if (!integration) {
    logger.warn(`[Meli Service] No se encontró integración de Mercado Libre.`);
    return null;
  }

  const bufferSeconds = 300;
  const isTokenExpired = !integration.expiresAt || new Date() > new Date(integration.expiresAt.getTime() - bufferSeconds * 1000);

  if (isTokenExpired) {
    return await refreshAccessToken(integration);
  }
  return integration.accessToken;
};

/**
 * Intercambia el código de autorización por un token de acceso y lo guarda en la DB.
 * @param {string} code - El código de autorización de Meli.
 * @param {string} codeVerifier - El verificador PKCE.
 * @param {string} userId - El ID del usuario admin que realiza la conexión.
 */
const exchangeCodeForToken = async (code, codeVerifier, userId) => {
  const config = getConfig();
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('client_id', config.MERCADOLIBRE_APP_ID);
  params.append('client_secret', config.MERCADOLIBRE_CLIENT_SECRET);
  params.append('code_verifier', codeVerifier);
  params.append('code', code);
  params.append('redirect_uri', config.MERCADOLIBRE_REDIRECT_URI);

  try {
    const { data } = await axios.post('https://api.mercadolibre.com/oauth/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    });

    await prisma.meliIntegration.upsert({
      where: { userId: userId },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        meliUserId: data.user_id,
      },
      create: {
        userId: userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        meliUserId: data.user_id,
      },
    });
    logger.success(`[Meli Service] Integración con Meli guardada/actualizada para el usuario ${userId}`);
  } catch (error) {
    logger.error('[Meli Service] Error al intercambiar el código con Mercado Libre:', error.response?.data || error.message);
    throw new Error('Error al intercambiar el código con Mercado Libre. Verifica las credenciales.');
  }
};

/**
 * Procesa una notificación de webhook de Mercado Libre.
 * @param {object} notification - El cuerpo de la notificación.
 */
const processWebhookNotification = async (notification) => {
  if (notification.topic !== 'orders_v2') {
    logger.info(`[Meli Service] Ignorando notificación con topic: ${notification.topic}`);
    return;
  }

  try {
    const resourceUrl = notification.resource;
    const orderId = resourceUrl.split('/').pop();
    const orderDetails = await getOrder(orderId);

    if (orderDetails && orderDetails.status === 'paid') {
      logger.info(`[Meli Service] Orden ${orderId} pagada. Procesando stock...`);
      for (const item of orderDetails.order_items) {
        const product = await prisma.product.findUnique({ where: { meliItemId: item.item.id } });
        if (product) {
          const updatedProduct = await prisma.product.update({
            where: { id: product.id },
            data: { countInStock: { decrement: item.quantity } },
          });
          logger.success(`[Meli Service] Stock actualizado para ${updatedProduct.name}. Nuevo stock: ${updatedProduct.countInStock}`);
        }
      }
    }
  } catch (error) {
    logger.error(`[Meli Service] Error procesando webhook: ${error.message}`);
  }
};

/**
 * Obtiene el ID de vendedor de la integración activa de Mercado Libre.
 * @returns {Promise<string|null>}
 */
const getMeliSellerId = async () => {
  const integration = await prisma.meliIntegration.findFirst();
  return integration ? integration.meliUserId : null;
};

/**
 * Obtiene los pedidos recientes de un vendedor desde la API de Mercado Libre.
 * @param {string} sellerId - El ID del vendedor en Mercado Libre.
 * @returns {Promise<Array>} - Un array de pedidos.
 */
const fetchMeliOrders = async (sellerId) => {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('No se pudo obtener un token de acceso válido para Mercado Libre.');
  }

  try {
    const { data } = await axios.get(`https://api.mercadolibre.com/orders/search`, {
      params: { seller: sellerId, sort: 'date_desc', limit: 50 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.results || [];
  } catch (error) {
    logger.error('[Meli Service] Error al obtener pedidos de Meli:', error.response?.data || error.message);
    throw new Error('No se pudieron obtener los pedidos de Mercado Libre.');
  }
};

/**
 * Obtiene los detalles de una orden de Mercado Libre.
 * @param {string} orderId - El ID de la orden en Mercado Libre.
 * @returns {Promise<object|null>}
 */
const getOrder = async (orderId) => {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('No se pudo obtener un token de acceso válido.');
  }
  try {
    const { data } = await axios.get(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return data;
  } catch (error) {
    logger.error(`[Meli Service] Error al obtener la orden ${orderId}:`, error.response?.data || error.message);
    return null;
  }
};

export {
  getValidAccessToken,
  exchangeCodeForToken,
  processWebhookNotification,
  getMeliSellerId,
  fetchMeliOrders,
  getOrder,
};
