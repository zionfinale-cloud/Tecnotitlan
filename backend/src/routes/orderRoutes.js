// backend/src/routes/orderRoutes.js
import express from 'express';
import asyncHandler from 'express-async-handler';
import {
  addOrderItems,
  createStripePaymentIntent,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getAllOrders,
  updateOrderStatus, // Importar nueva función
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Para evitar que el servidor se caiga por errores en funciones asíncronas, envolvemos todos los controladores.
router.route('/').post(protect, asyncHandler(addOrderItems)).get(protect, checkPermission('order:read'), asyncHandler(getAllOrders));
router.route('/myorders').get(protect, asyncHandler(getMyOrders));
router.route('/:id').get(protect, asyncHandler(getOrderById));
router.route('/:id/create-payment-intent').post(protect, asyncHandler(createStripePaymentIntent));
router.route('/:id/pay').put(protect, asyncHandler(updateOrderToPaid));
router.route('/:id/status').put(protect, checkPermission('order:update'), asyncHandler(updateOrderStatus)); // Correcto
router.route('/:id/deliver').put(protect, checkPermission('order:update'), asyncHandler(updateOrderToDelivered)); // Correcto
export default router;
