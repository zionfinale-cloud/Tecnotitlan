import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Todas las rutas de configuración requieren que el usuario sea un administrador con permisos.
router.route('/')
    .get(protect, checkPermission('setting:read'), getSettings)
    .put(protect, checkPermission('setting:update'), updateSettings);

export default router;