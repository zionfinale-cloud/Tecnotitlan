import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  beginTwoFactorSetup,
  completeTwoFactorLogin,
  disableTwoFactor,
  enableTwoFactor,
  getSecurityStatus,
  regenerateRecoveryCodes,
} from '../controllers/securityController.js';
import { listMySecurityActivity } from '../controllers/auditController.js';

const router = express.Router();

router.post('/2fa/verify-login', completeTwoFactorLogin);
router.get('/status', protect, getSecurityStatus);
router.get('/activity', protect, listMySecurityActivity);
router.post('/2fa/setup', protect, beginTwoFactorSetup);
router.post('/2fa/enable', protect, enableTwoFactor);
router.post('/2fa/disable', protect, disableTwoFactor);
router.post('/2fa/recovery-codes', protect, regenerateRecoveryCodes);

export default router;
