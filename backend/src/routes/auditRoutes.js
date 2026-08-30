import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { ForbiddenError } from '../utils/errorUtils.js';
import { listAuditLogs } from '../controllers/auditController.js';

const router = express.Router();
const superAdminOnly = (req, res, next) => req.user?.role?.name === 'SUPER_ADMIN'
  ? next()
  : next(new ForbiddenError('Solo el Super Admin puede consultar la auditoria completa.'));

router.get('/', protect, superAdminOnly, listAuditLogs);

export default router;
