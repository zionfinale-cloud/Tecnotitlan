import express from 'express';
import asyncHandler from 'express-async-handler';
import { getPublicSettings, getSettings, updateSettings } from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/public', asyncHandler(getPublicSettings));

router.route('/')
    .get(protect, checkPermission('setting:read'), asyncHandler(getSettings))
    .put(protect, checkPermission('setting:update'), asyncHandler(updateSettings));

export default router;
