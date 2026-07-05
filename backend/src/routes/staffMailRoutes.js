import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createTicketFromMail,
  getInboxMessage,
  getInboxMessages,
  sendStaffMessage,
} from '../controllers/staffMailController.js';

const router = express.Router();

const staffMailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Demasiados intentos de correo desde esta IP. Intenta de nuevo en unos minutos.',
  },
});

router.use(staffMailLimiter);

router.post('/messages', getInboxMessages);
router.post('/messages/:uid', getInboxMessage);
router.post('/send', sendStaffMessage);
router.post('/tickets', createTicketFromMail);

export default router;
