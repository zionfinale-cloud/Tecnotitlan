import express from 'express';
import {
  getAllPermissions,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/roleController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Todas las rutas de roles requieren que el usuario sea al menos un administrador.
// Para un control más granular, usamos checkPermission.

// Obtener todos los permisos disponibles
router.route('/permissions').get(protect, checkPermission('role:read'), getAllPermissions);

// Rutas para gestionar roles
router
  .route('/')
  .get(protect, checkPermission('role:read'), getAllRoles)
  .post(protect, checkPermission('role:create'), createRole);

router
  .route('/:id')
  .get(protect, checkPermission('role:read'), getRoleById)
  .put(protect, checkPermission('role:update'), updateRole)
  .delete(protect, checkPermission('role:delete'), deleteRole);

export default router;