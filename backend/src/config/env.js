// Lista de variables de entorno críticas para el funcionamiento de la aplicación.
const requiredEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'CLIENT_URL_PRIMARY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  // Detiene la aplicación si faltan variables críticas
  throw new Error(`Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
}

// Exporta un objeto de configuración limpio y validado.
export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  UPLOAD_STRATEGY: process.env.UPLOAD_STRATEGY || 'local',
  CLIENT_URL_PRIMARY: process.env.CLIENT_URL_PRIMARY,
  CLIENT_URL_SECONDARY: process.env.CLIENT_URL_SECONDARY,
};


// Este archivo sirve como la configuración base del entorno.
// La lógica principal ahora está en `configService.js`.
export default config;
