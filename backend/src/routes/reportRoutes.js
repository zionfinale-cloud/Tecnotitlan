// d:\PowerUpMovil\backend\src\routes\reportRoutes.js
import express from 'express';
import asyncHandler from 'express-async-handler';
import {
  getSalesSummary,
  getProfitReport,
  getTopSellingProducts,
  getStockLevels,
  getLowStockReport
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// @route   GET /api/reports/sales-summary
// @desc    Obtener resumen de ventas (ahora con filtros de fecha opcionales)
// @access  Private/Admin
router.get('/sales-summary', protect, checkPermission('report:read'), asyncHandler(getSalesSummary));

// @route   GET /api/reports/top-selling-products
// @desc    Obtener los productos más vendidos
// @access  Private/Admin
router.get('/top-selling-products', protect, checkPermission('report:read'), asyncHandler(getTopSellingProducts));

// @route   GET /api/reports/profit-summary
// @desc    Obtener reporte de ganancias
// @access  Private/Admin
router.get('/profit-summary', protect, checkPermission('report:read'), asyncHandler(getProfitReport));

router.get('/stock-levels', protect, checkPermission('report:read'), asyncHandler(getStockLevels));

router.get('/low-stock', protect, checkPermission('report:read'), asyncHandler(getLowStockReport));

export default router;