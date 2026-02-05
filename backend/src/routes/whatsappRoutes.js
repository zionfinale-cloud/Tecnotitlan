import express from 'express';
import * as whatsappService from '../services/whatsappService.js';

const router = express.Router();

// Endpoint simple para verificar estado (útil si no hay frontend)
router.get('/status', (req, res) => {
    const client = whatsappService.getClient();
    if (client && client.user) {
        res.json({ status: 'CONNECTED', user: client.user });
    } else {
        res.json({ status: 'INITIALIZING_OR_DISCONNECTED' });
    }
});

export default router;