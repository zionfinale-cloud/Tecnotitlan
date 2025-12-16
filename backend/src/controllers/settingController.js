import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { loadConfigFromDB, getConfig } from '../services/configService.js';
import logger from '../utils/logger.js';

const PUBLIC_SETTINGS = [
  'siteName',
  'siteLogoUrl',
  'accentColor',
  'SOCIAL_FACEBOOK_URL',
  'SOCIAL_INSTAGRAM_URL',
  'SOCIAL_TIKTOK_URL',
];

/**
 * @desc    Get all editable settings
 * @route   GET /api/settings
 * @access  Private/Admin
 */
const getSettings = asyncHandler(async (req, res) => {
  // Solo devolvemos las que son seguras para editar desde el frontend
  const settings = await prisma.setting.findMany({ where: { isEditable: true } });
  res.status(200).json({
    status: 'success',
    data: {
      settings,
    },
  });
});

/**
 * @desc    Update a setting by its key
 * @route   PUT /api/settings/:key
 * @access  Private/Admin
 */
const updateSetting = asyncHandler(async (req, res, next) => {
  const { key } = req.params;
  const { value } = req.body;

  if (typeof value === 'undefined') {
    res.status(400);
    throw new Error('El valor de la configuración es requerido.');
  }

  const setting = await prisma.setting.findUnique({ where: { key } });

  if (!setting) {
    res.status(404);
    throw new Error(`Configuración con clave '${key}' no encontrada.`);
  }

  if (!setting.isEditable) {
    res.status(403);
    throw new Error(`La configuración '${key}' no es editable.`);
  }

  const updatedSetting = await prisma.setting.update({
    where: { key },
    data: { value },
  });

  // ¡Paso clave! Recargamos la configuración en la caché.
  await loadConfigFromDB();
  logger.info(`[Config] Configuración '${key}' actualizada y recargada en caché.`);

  res.status(200).json({
    status: 'success',
    data: {
      setting: updatedSetting,
    },
  });
});

/**
 * @desc    Upload site logo
 * @route   POST /api/settings/logo
 * @access  Private/Admin
 */
const uploadSiteLogo = asyncHandler(async (req, res, next) => {
  // El middleware de multer ya hizo su trabajo: guardó el archivo como 'logo.png'
  // en la carpeta 'frontend/public/images/logo/'.
  if (!req.file) {
    res.status(400);
    throw new Error('No se ha subido ningún archivo.');
  }

  // La ruta que guardamos en la BD es la ruta PÚBLICA, no la del sistema de archivos.
  const publicLogoUrl = '/images/logo/logo.png';

  await prisma.setting.upsert({
    where: { key: 'siteLogoUrl' },
    update: { value: publicLogoUrl },
    create: { key: 'siteLogoUrl', value: publicLogoUrl, isEditable: true, isPublic: true },
  });

  await loadConfigFromDB();
  logger.info(`[Config] Logo del sitio actualizado y recargado en caché.`);

  res.status(200).json({
    status: 'success',
    data: { url: publicLogoUrl }, // Devolvemos la ruta pública para la vista previa.
    message: 'Logo actualizado correctamente. Refresca la página para ver los cambios.',
  });
});

/**
 * @desc    Get all public settings
 * @route   GET /api/settings/public
 * @access  Public
 */
const getPublicSettings = asyncHandler(async (req, res, next) => {
  const settingsList = await prisma.setting.findMany({ where: { key: { in: PUBLIC_SETTINGS } } });

  // Transforma el array de la DB en un solo objeto, que es lo que el frontend espera.
  const settingsObject = settingsList.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  // El interceptor de apiService en el frontend espera la propiedad 'data'.
  // Ahora 'data' contiene el objeto que el SettingsContext necesita.
  res.status(200).json({ status: 'success', data: settingsObject });
});

/**
 * @desc    Get PayPal Client ID
 * @route   GET /api/config/paypal
 * @access  Public
 */
const getPaypalClientId = asyncHandler(async (req, res, next) => {
  // Usamos getConfig para obtener el valor desde la caché, es más eficiente.
  const config = getConfig();
  const clientId = config.PAYPAL_CLIENT_ID;

  if (clientId) {
    res.json({ clientId });
  } else {
    logger.error('[Config] PAYPAL_CLIENT_ID no está configurado en el sistema.');
    res.status(404);
    throw new Error('La configuración de pago no está disponible.');
  }
});


/**
 * @desc    Get Stripe Publishable Key
 * @route   GET /api/config/stripe
 * @access  Public
 */
const getStripePublishableKey = asyncHandler(async (req, res, next) => {
  const config = getConfig();
  const key = config.STRIPE_PUBLISHABLE_KEY;

  if (key) {
    res.json({ publishableKey: key });
  } else {
    logger.error('[Config] STRIPE_PUBLISHABLE_KEY no está configurado en el sistema.');
    res.status(404);
    throw new Error('La configuración de pago no está disponible.');
  }
});

export {
  getSettings,
  updateSetting,
  uploadSiteLogo,
  getPublicSettings,
  getPaypalClientId,
  getStripePublishableKey,
};
