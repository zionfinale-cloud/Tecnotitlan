import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import * as tiktokShopService from '../services/tiktokShopService.js';
import { getConfig } from '../services/configService.js';
import { BadRequestError } from '../utils/errorUtils.js';

const getStatus = asyncHandler(async (req, res) => {
  const data = await tiktokShopService.getStatus();
  res.json({ status: 'success', data });
});

const getAuthUrl = asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.tiktok_oauth_state = state;
  const authUrl = tiktokShopService.buildAuthorizationUrl(state);
  res.json({ status: 'success', data: { authUrl } });
});

const handleCallback = asyncHandler(async (req, res) => {
  const code = req.query.code || req.query.auth_code;
  const state = req.query.state;

  if (!code) throw new BadRequestError('TikTok no devolvio codigo de autorizacion.');

  if (req.session?.tiktok_oauth_state && state && req.session.tiktok_oauth_state !== state) {
    throw new BadRequestError('El estado de autorizacion de TikTok no coincide. Intenta conectar de nuevo.');
  }

  await tiktokShopService.exchangeCodeForToken(code);
  if (req.session) delete req.session.tiktok_oauth_state;

  const clientUrl = getConfig().CLIENT_URL_PRIMARY || 'https://tecnotitlan.com.mx';
  res.redirect(`${clientUrl.replace(/\/$/, '')}/admin/settings/tiktok?connected=1`);
});

const disconnect = asyncHandler(async (req, res) => {
  await tiktokShopService.disconnect();
  res.json({ status: 'success', message: 'TikTok Shop desconectado correctamente.' });
});

export { getStatus, getAuthUrl, handleCallback, disconnect };
