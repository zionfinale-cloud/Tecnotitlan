import express from 'express';
import asyncHandler from 'express-async-handler';
import {
    getPublicSettings,
    getSettings,
    updateSettings,
    getSystemSettings,
    updateSystemSettings,
} from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { ForbiddenError } from '../utils/errorUtils.js';

const router = express.Router();

const superAdminOnly = (req, res, next) => {
    if (req.user?.role?.name === 'SUPER_ADMIN') return next();
    return next(new ForbiddenError('Solo el Super Admin puede modificar esta configuracion.'));
};

router.get('/public', asyncHandler(getPublicSettings));

router.route('/system')
    .get(protect, superAdminOnly, checkPermission('system:configure'), asyncHandler(getSystemSettings))
    .put(protect, superAdminOnly, checkPermission('system:configure'), asyncHandler(updateSystemSettings));

router.route('/')
    .get(protect, checkPermission('setting:read'), asyncHandler(getSettings))
    .put(protect, checkPermission('setting:update'), asyncHandler(updateSettings));

export default router;
