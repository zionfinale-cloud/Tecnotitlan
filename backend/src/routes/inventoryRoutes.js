import express from 'express';
import {
  createInvestment,
  createInvestmentCashMovement,
  createManualSale,
  createStockEntry,
  deleteInvestment,
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
  .get(checkPermission('finance:read_costs'), getInvestments)
  .post(checkPermission('finance:read_costs'), createInvestment);

router
  .route('/investments/:id')
  .delete(checkPermission('finance:read_costs'), deleteInvestment);

router
  .route('/investments/:id/cash-movements')
  .post(checkPermission('finance:read_costs'), createInvestmentCashMovement);

router
  .route('/entries')
  .post(checkPermission('finance:read_costs'), createStockEntry);

router
  .route('/transfers')
  .post(checkPermission('product:update'), transferStockToChannel);

router
  .route('/sales')
  .post(checkPermission('product:update'), createManualSale);

router
  .route('/movements')
  .get(checkPermission('report:read', 'product:read'), getMovements);

router
  .route('/overview')
  .get(checkPermission('product:read', 'report:read'), getInventoryOverview);

router
  .route('/cut')
  .get(checkPermission('finance:read_costs'), getInventoryCut);

export default router;
