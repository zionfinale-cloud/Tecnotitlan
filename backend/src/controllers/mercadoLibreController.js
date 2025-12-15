import asyncHandler from 'express-async-handler';
import axios from 'axios';
import { getConfig } from '../services/configService.js';
import prisma from '../config/prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';

const MELI_API_URL = 'https://api.mercadolibre.com';

/**
 * @desc    Redirige al usuario a la página de autorización de Mercado Libre.
 * @route   GET /api/mercadolibre/auth
 * @access  Private/Admin
 */
export const handleMeliAuth = asyncHandler(async (req, res) => {
  const config = getConfig();
  const { MELI_APP_ID, MELI_REDIRECT_URI } = config;

  if (!MELI_APP_ID || !MELI_REDIRECT_URI) {
    throw new Error('La configuración de Mercado Libre (APP_ID o REDIRECT_URI) no está completa.');
  }

  const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=${MELI_APP_ID}&redirect_uri=${MELI_REDIRECT_URI}`;
  res.redirect(authUrl);
});

/**
 * @desc    Intercambia el código de autorización por un token de acceso y lo guarda.
 * @route   POST /api/mercadolibre/token
 * @access  Private/Admin
 */
export const exchangeCodeForToken = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    throw new BadRequestError('No se proporcionó el código de autorización.');
  }

  const config = getConfig();
  const { MELI_APP_ID, MELI_CLIENT_SECRET, MELI_REDIRECT_URI } = config;

  if (!MELI_APP_ID || !MELI_CLIENT_SECRET || !MELI_REDIRECT_URI) {
    throw new Error('La configuración de Mercado Libre no está completa.');
  }

  const response = await axios.post(`${MELI_API_URL}/oauth/token`, {
    grant_type: 'authorization_code',
    client_id: MELI_APP_ID,
    client_secret: MELI_CLIENT_SECRET,
    code,
    redirect_uri: MELI_REDIRECT_URI,
  });

  const { access_token, refresh_token, user_id } = response.data;

  // Guarda o actualiza las credenciales en la base de datos
  await prisma.setting.upsert({
    where: { key: 'meli-user-id' },
    update: { value: user_id.toString() },
    create: { key: 'meli-user-id', value: user_id.toString() },
  });
  await prisma.setting.upsert({
    where: { key: 'meli-access-token' },
    update: { value: access_token },
    create: { key: 'meli-access-token', value: access_token },
  });
  await prisma.setting.upsert({
    where: { key: 'meli-refresh-token' },
    update: { value: refresh_token },
    create: { key: 'meli-refresh-token', value: refresh_token },
  });

  res.status(200).json({ message: 'Conexión con Mercado Libre establecida con éxito.' });
});

/**
 * @desc    Obtiene el estado actual de la integración con Mercado Libre.
 * @route   GET /api/mercadolibre/status
 * @access  Private/Admin
 */
export const getStatus = asyncHandler(async (req, res) => {
  const config = getConfig();
  const accessToken = config.MELI_ACCESS_TOKEN;

  if (accessToken) {
    res.json({ isConnected: true, message: 'Conectado a Mercado Libre.' });
  } else {
    res.json({ isConnected: false, message: 'No conectado a Mercado Libre.' });
  }
});

// --- Placeholder para otras funciones ---

export const handleWebhookNotification = (req, res) => {
  console.log('Notificación de Mercado Libre recibida:', req.body);
  res.status(200).send('OK');
};

export const getMeliOrders = asyncHandler(async (req, res) => {
  // Lógica para obtener pedidos usando el access token de getConfig()
  res.status(501).json({ message: 'Funcionalidad no implementada.' });
});

export const disconnectMeli = asyncHandler(async (req, res) => {
  // Lógica para eliminar las credenciales de la base de datos
  res.status(501).json({ message: 'Funcionalidad no implementada.' });
});

export const getMeliItemDetails = asyncHandler(async (req, res) => {
  // Lógica para obtener detalles de un item
  res.status(501).json({ message: 'Funcionalidad no implementada.' });
});

export const syncStock = asyncHandler(async (req, res) => {
  // Lógica para sincronizar stock
  res.status(501).json({ message: 'Funcionalidad no implementada.' });
});