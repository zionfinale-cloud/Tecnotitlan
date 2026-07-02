import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  archiveProduct,
  unarchiveProduct,
  permanentlyDeleteProduct,
  updateProductStock,
  getProductStockLevels,
  getLowStockProducts,
  countProducts,
  linkProductToMeli,
  createProductReview,
  deleteProductReview,
  getTopProducts,
  getMostStockedProducts,
  exportProductsToCSV,
  bulkUpdateProducts,
} from '../controllers/productController.js';
import { protect, optionalProtect } from '../middleware/authMiddleware.js';
import { validateProduct } from '../middleware/validationMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// --- Rutas de Admin (Protegidas) ---
// Rutas específicas de admin (sin :id) que deben ir primero para evitar conflictos
router.get('/inventory/levels', protect, checkPermission('product:read'), getProductStockLevels);
router.get('/inventory/low-stock', protect, checkPermission('report:read'), getLowStockProducts);
router.get('/count', protect, checkPermission('product:read'), countProducts);
router.get('/export/csv', protect, checkPermission('product:read'), exportProductsToCSV);
router.put('/bulk-update', protect, checkPermission('product:update'), bulkUpdateProducts);

// --- Rutas Públicas Especiales ---
router.get('/top', getTopProducts); // Debe ir antes de /:sku
router.get('/most-stock', getMostStockedProducts);

// --- Rutas CRUD principales (sin parámetros dinámicos) ---
router.route('/')
  .get(getProducts) // Público
  .post(protect, checkPermission('product:create'), validateProduct, createProduct); // Admin

// --- Rutas específicas por SKU o ID (deben ir antes de la genérica) ---
router.put('/:sku/unarchive', protect, checkPermission('product:update'), unarchiveProduct);
router.delete('/:sku/permanent', protect, checkPermission('product:delete'), permanentlyDeleteProduct);
router.route('/:sku/reviews').post(protect, createProductReview);
router.route('/:sku/reviews/:reviewId').delete(protect, checkPermission('product:delete'), deleteProductReview);
router.put('/:id/link-meli', protect, checkPermission('product:update'), linkProductToMeli);
router.put('/:id/stock', protect, checkPermission('product:update'), updateProductStock);

// --- Ruta genérica por SKU (debe ir al final) ---
router.route('/:sku')
  .get(optionalProtect, getProductById)
  .put(protect, checkPermission('product:update'), validateProduct, updateProduct) // Admin
  .delete(protect, checkPermission('product:delete'), archiveProduct); // Admin - Ahora archiva en lugar de eliminar

export default router;
