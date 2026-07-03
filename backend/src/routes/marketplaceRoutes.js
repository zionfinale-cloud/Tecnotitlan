import express from 'express';
import {
  archiveMarketplaceListing,
  createExternalOrder,
  getExternalOrders,
  getMarketplaceListings,
  getMarketplaceSummary,
  updateMarketplaceListing,
  upsertMarketplaceListing,
} from '../controllers/marketplaceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/summary', checkPermission('product:read', 'order:read'), getMarketplaceSummary);

router
  .route('/listings')
  .get(checkPermission('product:read'), getMarketplaceListings)
  .post(checkPermission('product:update'), upsertMarketplaceListing);

router
  .route('/listings/:id')
  .put(checkPermission('product:update'), updateMarketplaceListing)
  .delete(checkPermission('product:update'), archiveMarketplaceListing);

router
  .route('/external-orders')
  .get(checkPermission('order:read'), getExternalOrders)
  .post(checkPermission('order:update'), createExternalOrder);

export default router;
