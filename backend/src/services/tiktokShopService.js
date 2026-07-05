import axios from 'axios';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { getConfig } from './configService.js';
import { BadRequestError } from '../utils/errorUtils.js';
import logger from '../utils/logger.js';

const secondsToDate = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(Date.now() + value * 1000);
};

const requireConfig = () => {
  const config = getConfig();
  const appKey = config.TIKTOK_SHOP_APP_KEY;
  const appSecret = config.TIKTOK_SHOP_APP_SECRET;
  const redirectUri = config.TIKTOK_SHOP_REDIRECT_URI || 'https://api.tecnotitlan.com.mx/api/tiktok/callback';

  if (!appKey || !appSecret) {
    throw new BadRequestError('Configura TIKTOK_SHOP_APP_KEY y TIKTOK_SHOP_APP_SECRET antes de conectar TikTok Shop.');
  }

  return {
    appKey,
    appSecret,
    redirectUri,
    authBaseUrl: (config.TIKTOK_SHOP_AUTH_BASE_URL || 'https://auth.tiktok-shops.com/api/v2').replace(/\/$/, ''),
  };
};

export const buildAuthorizationUrl = (state) => {
  const { appKey, authBaseUrl } = requireConfig();
  const params = new URLSearchParams({
    app_key: appKey,
    state: state || crypto.randomBytes(16).toString('hex'),
  });

  return `${authBaseUrl}/oauth/authorize?${params.toString()}`;
};

export const exchangeCodeForToken = async (authCode, connectedBy = null) => {
  const { appKey, appSecret, authBaseUrl } = requireConfig();
  const cleanCode = String(authCode || '').trim();

  if (!cleanCode) throw new BadRequestError('TikTok no devolvio codigo de autorizacion.');

  try {
    const { data } = await axios.get(`${authBaseUrl}/token/get`, {
      params: {
        app_key: appKey,
        app_secret: appSecret,
        auth_code: cleanCode,
        grant_type: 'authorized_code',
      },
    });

    if (data?.code && Number(data.code) !== 0) {
      throw new Error(data.message || data.msg || 'TikTok rechazo el intercambio de token.');
    }

    const tokenData = data?.data || data || {};
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('TikTok no devolvio access_token.');

    const payload = {
      openId: tokenData.open_id || tokenData.openId || null,
      sellerName: tokenData.seller_name || tokenData.sellerName || null,
      sellerId: tokenData.seller_id || tokenData.sellerId || null,
      shopName: tokenData.shop_name || tokenData.shopName || null,
      shopCipher: tokenData.shop_cipher || tokenData.shopCipher || null,
      accessToken,
      refreshToken: tokenData.refresh_token || tokenData.refreshToken || null,
      accessTokenExpiresAt: secondsToDate(tokenData.access_token_expire_in || tokenData.accessTokenExpireIn || tokenData.expires_in),
      refreshTokenExpiresAt: secondsToDate(tokenData.refresh_token_expire_in || tokenData.refreshTokenExpireIn),
      connectedBy,
      rawData: tokenData,
    };

    const existing = await prisma.tikTokShopIntegration.findFirst();
    const integration = existing
      ? await prisma.tikTokShopIntegration.update({ where: { id: existing.id }, data: payload })
      : await prisma.tikTokShopIntegration.create({ data: payload });

    logger.info(`[TikTok Shop] Tienda conectada${payload.sellerName ? `: ${payload.sellerName}` : ''}.`);
    return integration;
  } catch (error) {
    logger.error('[TikTok Shop] Error al intercambiar codigo:', error.response?.data || error.message);
    throw new BadRequestError('No se pudo conectar TikTok Shop. Revisa App Key, App Secret y Redirect URL.');
  }
};

export const getStatus = async () => {
  const integration = await prisma.tikTokShopIntegration.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      openId: true,
      sellerName: true,
      sellerId: true,
      shopName: true,
      shopCipher: true,
      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      connectedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    isConnected: Boolean(integration),
    integration,
  };
};

export const disconnect = async () => {
  await prisma.tikTokShopIntegration.deleteMany({});
};

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && String(value) !== '');

export const recordWebhookEvent = async ({ payload = {}, headers = {} }) => {
  const eventType = pickFirst(
    payload.type,
    payload.event_type,
    payload.event,
    payload.eventType,
    payload.message_type,
    payload.data?.type,
  );
  const category = pickFirst(payload.category, payload.event_category, payload.data?.category);
  const shopId = pickFirst(payload.shop_id, payload.shopId, payload.data?.shop_id, payload.data?.shopId);
  const shopCipher = pickFirst(payload.shop_cipher, payload.shopCipher, payload.data?.shop_cipher, payload.data?.shopCipher);
  const messageId = pickFirst(
    payload.message_id,
    payload.messageId,
    payload.msg_id,
    payload.id,
    payload.data?.message_id,
    payload.data?.messageId,
  );

  const data = {
    eventType: eventType ? String(eventType) : null,
    category: category ? String(category) : null,
    shopId: shopId ? String(shopId) : null,
    shopCipher: shopCipher ? String(shopCipher) : null,
    messageId: messageId ? String(messageId) : null,
    payload,
    headers,
  };

  if (data.messageId) {
    return prisma.tikTokShopWebhookEvent.upsert({
      where: { messageId: data.messageId },
      update: {
        payload,
        headers,
        eventType: data.eventType,
        category: data.category,
        shopId: data.shopId,
        shopCipher: data.shopCipher,
      },
      create: data,
    });
  }

  return prisma.tikTokShopWebhookEvent.create({ data });
};

export const listWebhookEvents = async ({ limit = 50 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return prisma.tikTokShopWebhookEvent.findMany({
    orderBy: { receivedAt: 'desc' },
    take: safeLimit,
  });
};
