import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Rutas para /api/users
router.post('/register', registerUser); // FIX: Ruta explícita para que coincida con el frontend
router.post('/login', loginUser);

router.route('/')
  .get(protect, checkPermission('user:read'), getUsers);

// Ruta para el perfil del usuario (protegida)
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// Rutas de admin para gestionar un usuario específico por ID
router.route('/:id')
  .get(protect, checkPermission('user:read'), getUserById)
  .put(protect, checkPermission('user:update'), updateUser)
  .delete(protect, checkPermission('user:delete'), deleteUser);

export default router;
