import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { getReturnInspectionCases, getReturnCandidates, receiveReturnInspection, updateReturnInspectionItem, finalizeReturnInspection } from '../controllers/returnInspectionController.js';

const router = express.Router();
router.use(protect);
router.get('/', checkPermission('order:read', 'support:read', 'product:read'), getReturnInspectionCases);
router.get('/candidates', checkPermission('order:read', 'support:read'), getReturnCandidates);
router.post('/receive', checkPermission('order:update', 'support:update', 'product:update'), receiveReturnInspection);
router.put('/:caseId/items/:itemId', checkPermission('order:update', 'support:update', 'product:update'), updateReturnInspectionItem);
router.post('/:caseId/finalize', checkPermission('order:update', 'support:update', 'product:update'), finalizeReturnInspection);

export default router;
