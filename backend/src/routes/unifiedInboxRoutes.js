import express from 'express';
import { getUnifiedInbox, getUnifiedInboxCounts, searchInboxOrders, linkInboxOrder, unlinkInboxOrder, replyUnifiedInbox } from '../controllers/unifiedInboxController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', checkPermission('support:read', 'order:read', 'whatsapp:chat'), getUnifiedInbox);
router.get('/counts', checkPermission('support:read', 'order:read', 'whatsapp:chat'), getUnifiedInboxCounts);
router.get('/orders', checkPermission('support:read', 'order:read'), searchInboxOrders);
router.put('/:sourceType/:sourceId/order', checkPermission('support:update', 'order:update'), linkInboxOrder);
router.delete('/:sourceType/:sourceId/order', checkPermission('support:update', 'order:update'), unlinkInboxOrder);
router.post('/:sourceType/:sourceId/reply', checkPermission('support:update', 'whatsapp:chat', 'tecatl:reply'), replyUnifiedInbox);

export default router;
