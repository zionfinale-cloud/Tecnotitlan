import express from 'express';
import asyncHandler from 'express-async-handler';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Todas las rutas de configuración requieren que el usuario sea un administrador con permisos.
router.route('/')
    .get(asyncHandler(getSettings))
    .put(protect, checkPermission('setting:update'), asyncHandler(updateSettings));

export default router;