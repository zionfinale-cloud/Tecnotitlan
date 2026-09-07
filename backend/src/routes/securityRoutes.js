import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  beginTwoFactorSetup,
  completeTwoFactorLogin,
  disableTwoFactor,
  enableTwoFactor,
  getSecurityStatus,
  getOperationalReadiness,
  regenerateRecoveryCodes,
} from '../controllers/securityController.js';
import { listMySecurityActivity } from '../controllers/auditController.js';
import { ForbiddenError } from '../utils/errorUtils.js';

const router = express.Router();
const superAdminOnly = (req, res, next) => req.user?.role?.name === 'SUPER_ADMIN'
  ? next()
  : next(new ForbiddenError('Solo el Super Admin puede consultar el estado operativo.'));

router.post('/2fa/verify-login', completeTwoFactorLogin);
router.get('/status', protect, getSecurityStatus);
router.get('/activity', protect, listMySecurityActivity);
router.get('/readiness', protect, superAdminOnly, getOperationalReadiness);
router.post('/2fa/setup', protect, beginTwoFactorSetup);
router.post('/2fa/enable', protect, enableTwoFactor);
router.post('/2fa/disable', protect, disableTwoFactor);
router.post('/2fa/recovery-codes', protect, regenerateRecoveryCodes);

export default router;
