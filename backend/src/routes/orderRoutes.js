import express from 'express';
import asyncHandler from 'express-async-handler';
import {
  addOrderItems,
  createStripePaymentIntent,
  confirmStripePayment,
  getOrderByIdOperational,
  requestOrderCancellation,
  retryOrderInventoryOperational,
  updateOrderToPaid,
  updateOrderToDeliveredOperational,
  getMyOrders,
  getAllOrdersOperational,
  updateOrderStatusOperational,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router
  .route('/')
  .post(protect, asyncHandler(addOrderItems))
  .get(protect, checkPermission('order:read'), asyncHandler(getAllOrdersOperational));

router.route('/myorders').get(protect, asyncHandler(getMyOrders));
router.route('/:id').get(protect, asyncHandler(getOrderByIdOperational));
router.route('/:id/create-payment-intent').post(protect, asyncHandler(createStripePaymentIntent));
router.route('/:id/confirm-stripe-payment').post(protect, asyncHandler(confirmStripePayment));
router.route('/:id/pay').put(protect, asyncHandler(updateOrderToPaid));
router.route('/:id/cancel').put(protect, asyncHandler(requestOrderCancellation));
router.route('/:id/retry-inventory').put(protect, checkPermission('order:update'), asyncHandler(retryOrderInventoryOperational));
router.route('/:id/status').put(protect, checkPermission('order:update'), asyncHandler(updateOrderStatusOperational));
router.route('/:id/deliver').put(protect, checkPermission('order:update'), asyncHandler(updateOrderToDeliveredOperational));

export default router;
