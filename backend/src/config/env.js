const dotenv = require('dotenv');
const path =require('path');

// Carga las variables de entorno desde el archivo .env en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'PAYPAL_CLIENT_ID',
  'FRONTEND_URL',
  // --- NUEVAS VARIABLES REQUERIDAS PARA EMAIL ---
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
];

if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('PAYPAL_LIVE_CLIENT_ID');
}

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  // Detiene la aplicación si faltan variables críticas
  throw new Error(`Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
}

const config = {
  port: process.env.PORT || 3001,
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  frontendURL: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  paypal: {
    clientId: process.env.NODE_ENV === 'production'
      ? process.env.PAYPAL_LIVE_CLIENT_ID
      : process.env.PAYPAL_CLIENT_ID,
  },
  // --- NUEVA CONFIGURACIÓN DE EMAIL ---
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
};

module.exports = config;
