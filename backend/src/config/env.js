import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.warn(`[Config] No se pudo cargar el archivo .env en: ${envPath}`);
} else {
  console.log(`[Config] Variables cargadas desde: ${envPath}`);
}

const requiredEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'CLIENT_URL_PRIMARY',
];

const optionalIntegrationVars = [
  'RECAPTCHA_SECRET_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Faltan variables de entorno requeridas: ${missingVars.join(', ')}. (Leido desde: ${envPath})`);
}

const missingOptionalVars = optionalIntegrationVars.filter(varName => !process.env[varName]);
if (missingOptionalVars.length > 0) {
  console.warn(`Variables opcionales/integraciones pendientes: ${missingOptionalVars.join(', ')}`);
}

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  UPLOAD_STRATEGY: process.env.UPLOAD_STRATEGY || 'local',
  CLIENT_URL_PRIMARY: process.env.CLIENT_URL_PRIMARY,
  CLIENT_URL_SECONDARY: process.env.CLIENT_URL_SECONDARY,
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || 'Tecnotitlan NoReply <noreply@tecnotitlan.com.mx>',
  N8N_ORDER_WEBHOOK_URL: process.env.N8N_ORDER_WEBHOOK_URL,
  N8N_SUPPORT_WEBHOOK_URL: process.env.N8N_SUPPORT_WEBHOOK_URL,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  ADMIN_WHATSAPP_NUMBER: process.env.ADMIN_WHATSAPP_NUMBER,
  TIKTOK_SHOP_APP_KEY: process.env.TIKTOK_SHOP_APP_KEY,
  TIKTOK_SHOP_APP_SECRET: process.env.TIKTOK_SHOP_APP_SECRET,
  TIKTOK_SHOP_REDIRECT_URI: process.env.TIKTOK_SHOP_REDIRECT_URI,
  TIKTOK_SHOP_AUTH_BASE_URL: process.env.TIKTOK_SHOP_AUTH_BASE_URL || 'https://auth.tiktok-shops.com/api/v2',
  TIKTOK_SHOP_API_BASE_URL: process.env.TIKTOK_SHOP_API_BASE_URL || 'https://open-api.tiktokglobalshop.com',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
};

export default config;
