import express from 'express';
import asyncHandler from 'express-async-handler';
import multer from 'multer';
import * as whatsappService from '../services/whatsappService.js';
import { getConfig } from '../services/configService.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { ForbiddenError } from '../utils/errorUtils.js';

const router = express.Router();
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const superAdminOnly = (req, res, next) => {
  if (req.user?.role?.name === 'SUPER_ADMIN') return next();
  return next(new ForbiddenError('Solo el Super Admin puede configurar WhatsApp.'));
};

const canAttendWhatsApp = checkPermission('whatsapp:chat', 'support:update');

router.post('/evolution/webhook', asyncHandler(async (req, res) => {
  const expectedSecret = getConfig().EVOLUTION_WEBHOOK_SECRET;
  const providedSecret = req.get('x-evolution-secret') || req.query.secret;

  if (expectedSecret && providedSecret !== expectedSecret) {
    throw new ForbiddenError('Webhook de Evolution no autorizado.');
  }

  const result = await whatsappService.handleEvolutionWebhook(req.body);
  res.json({ status: 'success', data: result });
}));

router.use(protect);

router.get('/status', checkPermission('integration:read', 'whatsapp:chat', 'support:update'), (req, res) => {
  res.json({ status: 'success', data: whatsappService.getStatus() });
});

router.get('/qr', superAdminOnly, checkPermission('system:configure'), (req, res) => {
  res.json({ status: 'success', data: { qr: whatsappService.getLatestQr(), ...whatsappService.getStatus() } });
});

router.post('/initialize', superAdminOnly, checkPermission('system:configure'), asyncHandler(async (req, res) => {
  const status = await whatsappService.initialize();
  res.status(202).json({ status: 'success', data: status });
}));

router.post('/reset', superAdminOnly, checkPermission('system:configure'), asyncHandler(async (req, res) => {
  const status = await whatsappService.resetSession();
  res.status(202).json({ status: 'success', data: status });
}));

router.get('/chats', canAttendWhatsApp, asyncHandler(async (req, res) => {
  const chats = await whatsappService.listChats();
  res.json({ status: 'success', data: chats });
}));

router.get('/chats/:jid/messages', canAttendWhatsApp, asyncHandler(async (req, res) => {
  const data = await whatsappService.listMessages(decodeURIComponent(req.params.jid));
  res.json({ status: 'success', data });
}));

router.post('/chats/:jid/messages', canAttendWhatsApp, asyncHandler(async (req, res) => {
  await whatsappService.sendMessage(
    decodeURIComponent(req.params.jid),
    req.body.text,
    req.user?.name || req.user?.email || 'Panel Tecnotitlan',
  );
  const data = await whatsappService.listMessages(decodeURIComponent(req.params.jid));
  res.status(201).json({ status: 'success', data });
}));

router.post('/chats/:jid/media', canAttendWhatsApp, mediaUpload.single('media'), asyncHandler(async (req, res) => {
  await whatsappService.sendMediaMessage(
    decodeURIComponent(req.params.jid),
    req.file,
    req.body.caption,
    req.user?.name || req.user?.email || 'Panel Tecnotitlan',
  );
  const data = await whatsappService.listMessages(decodeURIComponent(req.params.jid));
  res.status(201).json({ status: 'success', data });
}));

export default router;
