import asyncHandler from 'express-async-handler';
import * as mercadoLibreService from '../services/mercadoLibreService.js';
import { getConfig } from '../services/configService.js';
import { generateRandomString, generateCodeChallenge } from '../utils/pkce.js';
import logger from '../utils/logger.js';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma

// @desc    Obtener el estado de la integración con Mercado Libre
// @route   GET /api/mercadolibre/status
// @access  Private/Admin
const getStatus = asyncHandler(async (req, res) => {
  const integration = await prisma.meliIntegration.findFirst({ where: { userId: req.user.id } });
  res.json({ isConnected: !!integration });
});

// @desc    Iniciar el flujo de autenticación con Mercado Libre (PKCE)
// @route   GET /api/mercadolibre/auth
// @access  Private/Admin
const handleMeliAuth = asyncHandler(async (req, res) => {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);
  
  // Guardar el verifier en la sesión del usuario para usarlo en el callback
  req.session.meli_code_verifier = verifier;

  const config = getConfig();
  const authUrl = `https://auth.mercadolibre.com.mx/authorization?response_type=code&client_id=${config.MERCADOLIBRE_APP_ID}&redirect_uri=${config.MERCADOLIBRE_REDIRECT_URI}&code_challenge=${challenge}&code_challenge_method=S256`;
  
  res.redirect(authUrl);
});

// @desc    Intercambiar el código de autorización por un token de acceso
// @route   POST /api/mercadolibre/token
// @access  Private/Admin
const exchangeCodeForToken = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const codeVerifier = req.session.meli_code_verifier; // Recuperar de la sesión

  if (!code || !codeVerifier) {
    res.status(400);
    throw new Error('Falta el código de autorización o el verificador de la sesión.');
  }

  await mercadoLibreService.exchangeCodeForToken(code, codeVerifier, req.user.id);
  
  // Limpiar el verifier de la sesión
  delete req.session.meli_code_verifier;

  res.status(200).json({ status: 'success', message: 'Mercado Libre conectado exitosamente.' });
});

// @desc    Recibe notificaciones de webhooks de Mercado Libre
// @route   POST /api/mercadolibre/notifications
// @access  Public
const handleWebhookNotification = asyncHandler(async (req, res) => {
  const notification = req.body;
  logger.info(`[Meli Webhook] Notificación recibida: ${JSON.stringify(notification)}`);

  // Responder inmediatamente a Meli para que no reintente.
  res.status(200).send('OK');

  // El procesamiento se hace en segundo plano (sin await)
  mercadoLibreService.processWebhookNotification(notification);
});

// @desc    Obtener los pedidos de Mercado Libre
// @route   GET /api/mercadolibre/orders
// @access  Private/Admin
const getMeliOrders = asyncHandler(async (req, res) => {
  const meliSellerId = await mercadoLibreService.getMeliSellerId();

  if (!meliSellerId) {
    res.status(404);
    throw new Error('No se ha configurado la integración con Mercado Libre.');
  }

  const orders = await mercadoLibreService.fetchMeliOrders(meliSellerId);

  res.status(200).json({
    status: 'success',
    data: {
      count: orders.length,
      orders,
    },
  });
});

/**
 * @desc    Obtener detalles de un item de Mercado Libre
 * @route   GET /api/mercadolibre/items/:meliItemId
 * @access  Private/Admin
 */
const getMeliItemDetails = asyncHandler(async (req, res) => {
  const { meliItemId } = req.params;
  const userId = req.user.id;

  const itemDetails = await mercadoLibreService.getItem(userId, meliItemId);

  if (!itemDetails) {
    res.status(404);
    throw new Error('No se encontró el artículo en Mercado Libre o no tienes acceso a él.');
  }

  res.status(200).json({ status: 'success', data: itemDetails });
});

/**
 * @desc    Sincronizar el stock de un producto local con Mercado Libre
 * @route   PUT /api/mercadolibre/products/:sku/sync
 * @access  Private/Admin
 */
const syncStock = asyncHandler(async (req, res) => {
  const { sku } = req.params;
  const userId = req.user.id;

  const product = await prisma.product.findUnique({ where: { sku } });

  if (!product) {
    res.status(404);
    throw new Error('Producto local no encontrado.');
  }

  if (!product.meliItemId) {
    res.status(400);
    throw new Error('Este producto no está vinculado a ninguna publicación de Mercado Libre.');
  }

  const newStock = product.countInStock;

  await mercadoLibreService.updateStock(userId, product.meliItemId, newStock);

  logger.info(`[Meli Sync] Stock del producto ${sku} (Meli ID: ${product.meliItemId}) actualizado a ${newStock}`);

  res.status(200).json({ status: 'success', message: `Stock actualizado a ${newStock} en Mercado Libre.` });
});

/**
 * @desc    Desconectar la cuenta de Mercado Libre
 * @route   DELETE /api/mercadolibre/disconnect
 * @access  Private/Admin
 */
const disconnectMeli = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const integration = await prisma.meliIntegration.findFirst({ where: { userId } });

  if (!integration) {
    res.status(404);
    throw new Error('No se encontró una integración de Mercado Libre para desconectar.');
  }

  // Borramos el registro de la integración de nuestra base de datos.
  await prisma.meliIntegration.delete({
    where: { id: integration.id },
  });

  logger.info(`[Meli] Integración desconectada para el usuario ${userId}`);

  res.status(200).json({ status: 'success', message: 'La cuenta de Mercado Libre ha sido desconectada.' });
});

export {
  getStatus,
  handleMeliAuth,
  exchangeCodeForToken,
  handleWebhookNotification,
  getMeliOrders,
  disconnectMeli,
  getMeliItemDetails,
  syncStock,
};
