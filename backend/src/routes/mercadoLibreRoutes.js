import express from 'express';
import {
  getStatus,
  getMeliAuthUrl,
  handleMeliAuth,
  handleMeliCallback,
  exchangeCodeForToken,
  handleWebhookNotification,
  getWebhookEvents,
  getMeliOrders,
  disconnectMeli,
  getMeliItemDetails,
  getPublicationRequirements,
  syncStock,
  getMeliClaims,
  syncMeliClaims,
  refreshMeliClaim,
  updateMeliClaim,
  sendMeliClaimMessage,
  executeMeliClaimAction,
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
router.get(
  '/publication-requirements',
  protect,
  checkPermission('integration:read'),
  getPublicationRequirements
);
router.put('/products/:sku/sync', protect, checkPermission('product:update'), syncStock);
router.post('/notifications', handleWebhookNotification);
router.get('/webhook-events', protect, checkPermission('integration:read'), getWebhookEvents);
router.get('/orders', protect, checkPermission('order:read'), getMeliOrders);
router.get('/claims', protect, checkPermission('order:read', 'support:read'), getMeliClaims);
router.post('/claims/sync', protect, checkPermission('order:update', 'support:update'), syncMeliClaims);
router.post('/claims/:claimId/refresh', protect, checkPermission('order:update', 'support:update'), refreshMeliClaim);
router.put('/claims/:claimId', protect, checkPermission('support:update'), updateMeliClaim);
router.post('/claims/:claimId/messages', protect, checkPermission('support:update'), sendMeliClaimMessage);
router.post('/claims/:claimId/actions', protect, checkPermission('support:update'), executeMeliClaimAction);

export default router;
