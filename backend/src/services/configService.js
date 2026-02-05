import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { config as envConfig } from '../config/env.js';

/**
 * @file configService.js
 * @description Servicio centralizado para gestionar la configuración de la aplicación.
 * Combina variables de entorno con configuraciones dinámicas de la base de datos.
 */

// `appConfig` almacenará la configuración fusionada y será la única fuente de verdad.
let appConfig = { ...envConfig }; // Inicializa con la configuración base del entorno.

/**
 * Carga o recarga la configuración desde la base de datos y la fusiona
 * con la configuración del entorno.
 * Las configuraciones de la base de datos tienen prioridad.
 */
export const loadConfigFromDB = async () => {
  try {
    const settings = await prisma.setting.findMany();

    if (settings.length > 0) {
      const dbConfig = settings.reduce((acc, setting) => {
        // Convierte 'mi-clave' a 'MI_CLAVE' para consistencia
        const key = setting.key.toUpperCase().replace(/-/g, '_');
        acc[key] = setting.value;
        return acc;
      }, {});

      // Fusiona la configuración, dando prioridad a los valores de la BD
      appConfig = { ...appConfig, ...dbConfig };
      logger.info('Configuración cargada/recargada desde la base de datos.');
    }
  } catch (error) {
    logger.error('No se pudo cargar la configuración desde la base de datos. Usando solo variables de entorno.', error);
    // La aplicación continuará con la configuración del entorno si la BD falla.
  }
};

/**
 * Inicializa la configuración al arrancar el servidor.
 * Esta función se llama una vez desde `index.js`.
 */
export const initializeConfig = async () => {
  // DEBUG: Log para verificar la URL de la base de datos que está usando el proceso.
  logger.debug('Verificando DATABASE_URL en uso:', { url: process.env.DATABASE_URL });
  logger.info('Configuración inicializada.');
  await loadConfigFromDB();
};

/**
 * Devuelve el objeto de configuración actual.
 * Esta es la función que el resto de la aplicación debe usar para acceder a la configuración.
 * @returns {object} El objeto de configuración completo.
 */
export const getConfig = () => {
  return appConfig;
};