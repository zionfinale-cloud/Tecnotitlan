import express from 'express';
import {
  disconnect,
  getAuthUrl,
  getStatus,
  handleCallback,
  handleWebhook,
  listWebhookEvents,
} from '../controllers/tiktokShopController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/status', protect, checkPermission('integration:read'), getStatus);
router.get('/auth-url', protect, checkPermission('integration:update'), getAuthUrl);
router.get('/webhook-events', protect, checkPermission('integration:read'), listWebhookEvents);
router.delete('/disconnect', protect, checkPermission('integration:delete'), disconnect);

router.get('/callback', handleCallback);
router.post('/webhook', handleWebhook);

export default router;
