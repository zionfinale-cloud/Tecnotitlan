const Setting = require('../models/Setting');
const User = require('../models/User');
const Counter = require('../models/Counter');
const logger = require('../utils/logger');
const { getConfig, reloadConfig } = require('./configService');

/**
 * Asegura que las configuraciones iniciales del .env existan en la base de datos.
 */
const seedSettings = async () => {
  const config = getConfig();
  const settingsToSeed = [
    { key: 'MERCADOLIBRE_APP_ID', value: config.MERCADOLIBRE_APP_ID || '', description: 'ID de la aplicación de Mercado Libre.', isEditable: true },
    { key: 'MERCADOLIBRE_CLIENT_SECRET', value: config.MERCADOLIBRE_CLIENT_SECRET || '', description: 'Clave secreta de la aplicación de Mercado Libre.', isEditable: true },
    { key: 'MERCADOLIBRE_REDIRECT_URI', value: config.MERCADOLIBRE_REDIRECT_URI || '', description: 'URL de redirección de Mercado Libre.', isEditable: true },
    { key: 'PAYPAL_CLIENT_ID', value: config.PAYPAL_CLIENT_ID || '', description: 'Client ID para la pasarela de pagos de PayPal.', isEditable: true },
    { key: 'ADMIN_WHATSAPP_NUMBER', value: config.ADMIN_WHATSAPP_NUMBER || '', description: 'Número de WhatsApp del admin (formato: 521...).', isEditable: true },
    { key: 'EMAIL_HOST', value: config.EMAIL_HOST || '', description: 'Host del servidor de correo (ej. smtp.gmail.com).', isEditable: true },
    { key: 'EMAIL_PORT', value: config.EMAIL_PORT || '', description: 'Puerto del servidor de correo (ej. 587).', isEditable: true },
    { key: 'EMAIL_USER', value: config.EMAIL_USER || '', description: 'Usuario para la autenticación del correo.', isEditable: true },
    { key: 'EMAIL_PASS', value: config.EMAIL_PASS || '', description: 'Contraseña de aplicación para el correo.', isEditable: true },
  ];

  let createdCount = 0;
  for (const settingData of settingsToSeed) {
    const existing = await Setting.findOne({ key: settingData.key });
    if (!existing) {
      await Setting.create(settingData);
      createdCount++;
    }
  }

  if (createdCount > 0) {
    logger.success(`[Seeder] ${createdCount} configuraciones iniciales creadas en la DB.`);
    // Si creamos nuevas configuraciones, debemos recargar la caché para que estén disponibles inmediatamente.
    await reloadConfig();
  }
};

/**
 * Asegura que el usuario administrador por defecto exista.
 */
const seedAdminUser = async () => {
  const adminEmail = 'admin@powerupmovil.com';
  const existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    await User.create({
      name: 'Gabriel Isaac Fernandez Vizcarra',
      email: adminEmail,
      password: 'Ze200785',
      role: 'admin',
    });
    logger.success(`[Seeder] Usuario administrador por defecto creado: ${adminEmail}`);
  }
};

/**
 * Asegura que los contadores necesarios para la aplicación existan.
 */
const seedCounters = async () => {
  const countersToSeed = ['orderNumber', 'productSku'];
  for (const counterId of countersToSeed) {
    await Counter.findOneAndUpdate(
      { _id: counterId },
      { $setOnInsert: { sequence_value: 0 } },
      { upsert: true, new: true }
    );
  }
};

const runInitialSeeders = async () => {
  logger.info('Verificando datos iniciales (seeders)...');
  await seedSettings();
  await seedAdminUser();
  await seedCounters();
  logger.success('Verificación de datos iniciales completada.');
};

module.exports = { runInitialSeeders };

