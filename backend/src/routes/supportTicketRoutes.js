import express from 'express';
import rateLimit from 'express-rate-limit';
import { createSupportTicket, getSupportTickets, updateSupportTicket } from '../controllers/supportTicketController.js';
import { optionalProtect, protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.post('/', contactLimiter, optionalProtect, createSupportTicket);
router.get('/', protect, checkPermission('support:read'), getSupportTickets);
router.put('/:id', protect, checkPermission('support:update'), updateSupportTicket);

export default router;
