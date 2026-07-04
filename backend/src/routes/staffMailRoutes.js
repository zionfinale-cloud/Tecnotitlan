import express from 'express';
import {
  createTicketFromMail,
  getInboxMessage,
  getInboxMessages,
  sendStaffMessage,
} from '../controllers/staffMailController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/messages', checkPermission('mail:read', 'access:admin_panel'), getInboxMessages);
router.post('/messages/:uid', checkPermission('mail:read', 'access:admin_panel'), getInboxMessage);
router.post('/send', checkPermission('mail:send', 'access:admin_panel'), sendStaffMessage);
router.post('/tickets', checkPermission('support:update', 'mail:read', 'access:admin_panel'), createTicketFromMail);

export default router;
