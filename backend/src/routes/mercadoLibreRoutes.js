import express from 'express';
import {
  getStatus,
  getMeliAuthUrl,
  handleMeliAuth,
  handleMeliCallback,
  exchangeCodeForToken,
  handleWebhookNotification,
  getMeliOrders,
  disconnectMeli,
  getMeliItemDetails,
  syncStock,
} from '../controllers/mercadoLibreController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/status', protect, checkPermission('integration:read'), getStatus);
router.get('/auth-url', protect, checkPermission('integration:update'), getMeliAuthUrl);
router.get('/auth', protect, checkPermission('integration:update'), handleMeliAuth);
router.get('/callback', handleMeliCallback);
router.post('/token', protect, checkPermission('integration:update'), exchangeCodeForToken);
router.delete('/disconnect', protect, checkPermission('integration:delete'), disconnectMeli);

router.get('/items/:meliItemId', protect, checkPermission('product:read'), getMeliItemDetails);
router.put('/products/:sku/sync', protect, checkPermission('product:update'), syncStock);
router.post('/notifications', handleWebhookNotification);
router.get('/orders', protect, checkPermission('order:read'), getMeliOrders);

export default router;
