import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import axios from 'axios';
import logger from '../utils/logger.js';
import { getConfig } from './configService.js';

let sock;
let io;

export const setSocketIO = (socketIoInstance) => {
    io = socketIoInstance;
};

export const initialize = async () => {
    logger.info('Initializing WhatsApp Service (Baileys)...');
    
    // Carpeta para guardar credenciales de sesión
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Tecnotitlan', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.info('QR Code received');
            if (io) {
                io.emit('qr', qr); // Enviamos el QR al frontend
                io.emit('status', 'QR_RECEIVED');
            }
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.warn(`Connection closed. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                initialize();
            } else {
                if(io) io.emit('status', 'DISCONNECTED');
            }
        } else if (connection === 'open') {
            logger.info('WhatsApp connection opened');
            if (io) {
                io.emit('status', 'READY');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

export const getClient = () => sock;

export const sendMessage = async (number, message) => {
    if (!sock) {
        throw new Error('WhatsApp client not initialized');
    }
    // Formatear el número para Baileys (ej: 5215512345678@s.whatsapp.net)
    const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
    return await sock.sendMessage(jid, { text: message });
};

export const sendAdminOrderPaidNotification = async (order) => {
    try {
        const config = getConfig();
        const adminWhatsappNumber = config.ADMIN_WHATSAPP_NUMBER;
        const n8nWebhookUrl = config.N8N_ORDER_WEBHOOK_URL;
        const total = Number(order?.totalPrice || 0).toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
        });
        const orderNumber = order?.orderNumber || order?.id || 'sin folio';
        const message = `Pago confirmado en Tecnotitlan\nPedido: ${orderNumber}\nTotal: ${total}`;

        if (adminWhatsappNumber && sock) {
            await sendMessage(adminWhatsappNumber, message);
        } else if (adminWhatsappNumber && !sock) {
            logger.warn(`[WhatsApp] No se envio aviso de pago ${orderNumber}: cliente no inicializado.`);
        }

        if (n8nWebhookUrl) {
            await axios.post(n8nWebhookUrl, {
                event: 'order.paid',
                orderId: order?.id,
                orderNumber,
                totalPrice: order?.totalPrice,
                paymentMethod: order?.paymentMethod,
                paidAt: order?.paidAt,
            });
        }

        if (!adminWhatsappNumber && !n8nWebhookUrl) {
            logger.info(`[WhatsApp] Aviso de pago ${orderNumber} omitido: sin ADMIN_WHATSAPP_NUMBER ni N8N_ORDER_WEBHOOK_URL.`);
        }
    } catch (error) {
        logger.error(`[WhatsApp] No se pudo enviar aviso de pago: ${error.message}`);
    }
};
