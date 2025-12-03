import express from 'express';
import {
  getSettings,
  updateSetting,
  uploadSiteLogo,
  getPublicSettings,
  getPaypalClientId,
  getStripePublishableKey,
} from '../controllers/settingController.js';

import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { upload } from '../controllers/uploadController.js'; // <-- 1. IMPORTAMOS EL MIDDLEWARE

const router = express.Router();

// --- Rutas Públicas (deben ir primero para evitar conflictos con rutas dinámicas) ---
router.route('/public').get(getPublicSettings);
router.route('/config/paypal').get(getPaypalClientId);
router.route('/config/stripe').get(getStripePublishableKey);

router.route('/').get(getSettings);

// --- RUTA DEDICADA PARA EL LOGO ---
// Cuando se haga un POST a esta ruta, el middleware 'upload.single("logo")' se ejecutará.
// La lógica en 'uploadController.js' detectará el fieldname 'logo' y guardará el archivo
// como 'logo.png' en la carpeta correcta del frontend.
router.route('/logo').post(protect, checkPermission('setting:update'), upload.single('logo'), uploadSiteLogo);

router.route('/:key').put(protect, checkPermission('setting:update'), updateSetting);

export default router;