import express from 'express';
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, checkPermission('category:create'), createCategory)
  .get(getCategories); // Pública para que el frontend pueda mostrar filtros

router.route('/:id')
  .put(protect, checkPermission('category:update'), updateCategory)
  .delete(protect, checkPermission('category:delete'), deleteCategory);

export default router;