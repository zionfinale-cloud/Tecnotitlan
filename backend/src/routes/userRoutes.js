import express from 'express';
import {
  registerUser,
  resendVerificationEmail,
  loginUser,
  verifyEmail,
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  logoutUser,
} from '../controllers/userController.js';
import { optionalProtect, protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { toAuthUserPayload } from '../utils/permissionUtils.js';

const router = express.Router();

// Rutas para /api/users
router.post('/register', registerUser); // FIX: Ruta explícita para que coincida con el frontend
router.post('/resend-verification', resendVerificationEmail);
router.get('/confirm/:token', verifyEmail);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/session', optionalProtect, (req, res) => res.json({
  status: 'success',
  data: req.user ? toAuthUserPayload(req.user) : null,
}));

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
