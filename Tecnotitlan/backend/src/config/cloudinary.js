import { v2 as cloudinary } from 'cloudinary';
import { getConfig } from '../services/configService.js';
import logger from '../utils/logger.js';

let isConfigured = false;

const configureCloudinary = () => {
  if (isConfigured) return;
  
  const config = getConfig();
  const cloudName = config.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.CLOUDINARY_API_KEY;
  const apiSecret = config.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    isConfigured = true;
    logger.info('Cloudinary configurado correctamente.');
  } else {
    logger.error('Faltan las credenciales de Cloudinary. La subida a Cloudinary fallará.');
  }
};

// En lugar de exportar la instancia, exportamos la función de configuración y la instancia.
export { cloudinary, configureCloudinary };