import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { upload, uploadImage } from '../controllers/uploadController.js'; // Importamos el middleware y el controlador unificados

const router = express.Router();

// --- Ruta de Subida ---
// La ruta ahora es mucho más simple. Usa el middleware 'upload' y luego el controlador 'uploadImage'.
router.post(
  '/',
  protect,
  checkPermission('product:create', 'setting:update'), // Permitir subidas para productos o configuración
  upload.single('image'), // El middleware se encarga de todo (local/cloudinary, logo/otro)
  uploadImage // El controlador solo responde con la ruta.
);

export default router;
