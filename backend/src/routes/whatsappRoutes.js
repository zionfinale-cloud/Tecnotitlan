import express from 'express';
import * as whatsappService from '../services/whatsappService.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.use(protect, checkPermission('integration:read'));

router.get('/status', (req, res) => {
  const client = whatsappService.getClient();
  if (client?.user) {
    return res.json({ status: 'CONNECTED', user: client.user });
  }
  return res.json({ status: 'INITIALIZING_OR_DISCONNECTED' });
});

router.post('/initialize', checkPermission('integration:update'), async (req, res) => {
  await whatsappService.initialize();
  res.status(202).json({ status: 'INITIALIZING' });
});

export default router;
