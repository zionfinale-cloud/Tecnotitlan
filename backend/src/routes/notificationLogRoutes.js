import express from 'express';
import { getNotificationLogs } from '../controllers/notificationLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/', checkPermission('system:configure', 'order:read'), getNotificationLogs);

export default router;
