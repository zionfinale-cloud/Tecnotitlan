import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import path from 'path'; // Para construir rutas
import { fileURLToPath } from 'url'; // Para convertir la URL del módulo a una ruta de archivo

// Reconstrucción de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env para el arranque inicial y para valores no gestionados en DB
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Ahora __dirname está definido

const prisma = new PrismaClient();
const configCache = {};

/**
 * Carga la configuración desde la base de datos y la fusiona con process.env.
 * La configuración de la DB tiene prioridad.
 */
const loadConfigFromDB = async () => {
  try {
    const settings = await prisma.setting.findMany();
    settings.forEach(setting => {
      configCache[setting.key] = setting.value;
    });
    logger.info('Configuración cargada/recargada desde la base de datos.');
  } catch (error) {
    logger.error('No se pudo cargar la configuración desde la base de datos. Usando solo variables de entorno.', error);
    // No detenemos el proceso, permitimos que la app continúe con .env
  }
};

/**
 * Inicializa la configuración al arrancar la aplicación.
 */
const initializeConfig = async () => {
  // 1. Cargar valores base desde .env como fallback
  Object.assign(configCache, process.env);

  // 2. Sobrescribir con valores de la DB
  await loadConfigFromDB();

  logger.info('Configuración inicializada.');
};

/**
 * Recarga la configuración desde la DB. Se usa después de actualizar en el panel de admin.
 */
const reloadConfig = async () => {
  logger.info('Recargando configuración desde la base de datos...');
  await loadConfigFromDB();
};

/**
 * Devuelve el objeto de configuración cacheado.
 */
const getConfig = () => {
  return configCache;
};

export {
  initializeConfig,
  reloadConfig,
  getConfig,
};