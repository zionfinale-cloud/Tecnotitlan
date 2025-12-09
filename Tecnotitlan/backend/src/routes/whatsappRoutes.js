import express from 'express';
import { getStatus, initializeClient, logoutClient } from '../controllers/whatsappController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Todas las rutas de WhatsApp requieren permisos de administrador
router.use(protect, checkPermission('integration:update'));

router.get('/status', getStatus);
router.post('/initialize', initializeClient);
router.post('/logout', logoutClient);

export default router;