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
