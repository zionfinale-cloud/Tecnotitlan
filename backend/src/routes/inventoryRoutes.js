import express from 'express';
import {
  createInvestment,
  createStockEntry,
  getInventoryCut,
  getInventoryOverview,
  getInvestments,
  getMovements,
  transferStockToChannel,
} from '../controllers/inventoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/investments')
  .get(checkPermission('report:read', 'product:read'), getInvestments)
  .post(checkPermission('product:update'), createInvestment);

router
  .route('/entries')
  .post(checkPermission('product:update'), createStockEntry);

router
  .route('/transfers')
  .post(checkPermission('product:update'), transferStockToChannel);

router
  .route('/movements')
  .get(checkPermission('report:read', 'product:read'), getMovements);

router
  .route('/overview')
  .get(checkPermission('product:read', 'report:read'), getInventoryOverview);

router
  .route('/cut')
  .get(checkPermission('report:read'), getInventoryCut);

export default router;
