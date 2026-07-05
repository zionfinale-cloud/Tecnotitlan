import path from 'path';
import fs from 'fs/promises';
import {
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    makeWASocket,
    useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import axios from 'axios';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { BadRequestError } from '../utils/errorUtils.js';
import { getConfig } from './configService.js';

let sock;
let io;
let latestQr = null;
let connectionStatus = 'DISCONNECTED';
let isInitializing = false;
let lastError = null;
let reconnectTimer = null;
let resetInProgress = false;

const ignoredJids = new Set(['status@broadcast']);
const uploadsRoot = path.resolve(process.cwd(), 'uploads');

const mediaTypeDefinitions = [
    { key: 'imageMessage', type: 'image' },
    { key: 'videoMessage', type: 'video' },
    { key: 'audioMessage', type: 'audio' },
    { key: 'documentMessage', type: 'document' },
    { key: 'stickerMessage', type: 'sticker' },
];

const mimeExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
};

const getBaseAuthDir = () => (
    process.env.WHATSAPP_AUTH_DIR
    || getConfig().WHATSAPP_AUTH_DIR
    || path.resolve(process.cwd(), 'auth_info_baileys')
);

let activeAuthDir = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeSessionName = (value) => {
    const safe = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || 'current';
};

const getActiveSessionFile = () => path.join(getBaseAuthDir(), 'active-session.txt');

const ensureActiveAuthDir = async () => {
    if (activeAuthDir) return activeAuthDir;

    const baseDir = getBaseAuthDir();
    await fs.mkdir(baseDir, { recursive: true });

    let sessionName = 'current';
    try {
        const savedSessionName = await fs.readFile(getActiveSessionFile(), 'utf8');
        sessionName = sanitizeSessionName(savedSessionName.trim());
    } catch (error) {
        await fs.writeFile(getActiveSessionFile(), sessionName, 'utf8');
    }

    activeAuthDir = path.join(baseDir, sessionName);
    await fs.mkdir(activeAuthDir, { recursive: true });
    return activeAuthDir;
};

const rotateActiveAuthDir = async () => {
    const baseDir = getBaseAuthDir();
    await fs.mkdir(baseDir, { recursive: true });

    const sessionName = `session-${Date.now()}`;
    await fs.writeFile(getActiveSessionFile(), sessionName, 'utf8');
    activeAuthDir = path.join(baseDir, sessionName);
    await fs.mkdir(activeAuthDir, { recursive: true });

    return activeAuthDir;
};

const emitStatus = () => {
    const payload = getStatus();
    if (!io) return;
    io.emit('whatsapp:status', payload);
    io.emit('status', payload.status);
};

const emitQr = (qr) => {
    if (!io) return;
    io.emit('whatsapp:qr', qr);
    io.emit('qr', qr);
};

const normalizePhone = (value = '') => String(value).replace(/\D/g, '');

const toJid = (value = '') => {
    if (!value) throw new BadRequestError('El numero de WhatsApp es requerido.');
    if (value.includes('@')) return value;
    return `${normalizePhone(value)}@s.whatsapp.net`;
};

const unwrapMessageContent = (content = {}) => (
    content.ephemeralMessage?.message
    || content.viewOnceMessage?.message
    || content.viewOnceMessageV2?.message
    || content.documentWithCaptionMessage?.message
    || content
);

const getMessageText = (message = {}) => {
    const content = unwrapMessageContent(message.message || {});
    return (
        content.conversation
        || content.extendedTextMessage?.text
        || content.imageMessage?.caption
        || content.videoMessage?.caption
        || content.documentMessage?.caption
        || content.buttonsResponseMessage?.selectedDisplayText
        || content.listResponseMessage?.title
        || content.templateButtonReplyMessage?.selectedDisplayText
        || null
    );
};

const getMediaDescriptor = (message = {}) => {
    const content = unwrapMessageContent(message.message || {});
    const definition = mediaTypeDefinitions.find((item) => content[item.key]);
    if (!definition) return null;

    const payload = content[definition.key] || {};
    return {
        type: definition.type,
        mimeType: payload.mimetype || 'application/octet-stream',
        fileName: payload.fileName,
        caption: payload.caption,
    };
};

const getExtension = (mimeType, fileName) => {
    const fromFile = path.extname(fileName || '');
    if (fromFile) return fromFile.toLowerCase();
    return mimeExtensions[mimeType] || '.bin';
};

const sanitizeFilePart = (value) => String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

const saveMediaBuffer = async ({ buffer, jid, type, mimeType, fileName, messageId }) => {
    if (!buffer?.length) return null;

    const phone = sanitizeFilePart((jid || 'unknown').split('@')[0]);
    const month = new Date().toISOString().slice(0, 7);
    const targetDir = path.join(uploadsRoot, 'whatsapp', month, phone);
    await fs.mkdir(targetDir, { recursive: true });

    const extension = getExtension(mimeType, fileName);
    const baseName = sanitizeFilePart(path.basename(fileName || '', extension))
        || sanitizeFilePart(`${type || 'archivo'}-${messageId || Date.now()}`);
    const finalName = `${baseName}-${Date.now()}${extension}`;
    const absolutePath = path.join(targetDir, finalName);

    await fs.writeFile(absolutePath, buffer);

    return {
        mediaUrl: `/uploads/whatsapp/${month}/${phone}/${finalName}`,
        mediaType: type,
        mediaMimeType: mimeType,
        fileName: fileName || finalName,
    };
};

const extractIncomingMedia = async (message, jid) => {
    const descriptor = getMediaDescriptor(message);
    if (!descriptor) return null;

    try {
        const buffer = await downloadMediaMessage(message, 'buffer', {}, {
            logger: pino({ level: 'silent' }),
            reuploadRequest: sock?.updateMediaMessage,
        });

        return saveMediaBuffer({
            buffer,
            jid,
            type: descriptor.type,
            mimeType: descriptor.mimeType,
            fileName: descriptor.fileName,
            messageId: message.key?.id,
        });
    } catch (error) {
        logger.error(`[WhatsApp] No se pudo descargar adjunto: ${error.message}`);
        return null;
    }
};

const getMediaLabel = (media) => {
    if (!media) return '[Mensaje no soportado]';
    if (media.mediaType === 'image') return '[Imagen]';
    if (media.mediaType === 'video') return '[Video]';
    if (media.mediaType === 'audio') return '[Audio]';
    if (media.mediaType === 'sticker') return '[Sticker]';
    return media.fileName ? `[Archivo: ${media.fileName}]` : '[Archivo]';
};

const getMessageDate = (timestamp) => {
    if (!timestamp) return new Date();
    const value = typeof timestamp === 'number'
        ? timestamp
        : Number(timestamp?.low || timestamp?.toString?.() || Date.now() / 1000);
    return new Date(value * 1000);
};

const getChatName = (jid, pushName) => {
    if (pushName) return pushName;
    const phone = jid.split('@')[0] || jid;
    return phone.startsWith('521') ? `+${phone}` : phone;
};

const persistMessage = async ({
    jid,
    messageId,
    text,
    fromMe,
    pushName,
    createdAt,
    sentBy,
    mediaUrl,
    mediaType,
    mediaMimeType,
    fileName,
}) => {
    if (!jid || ignoredJids.has(jid) || jid.endsWith('@g.us')) return null;

    const direction = fromMe ? 'OUTGOING' : 'INCOMING';
    const phone = jid.split('@')[0] || null;

    const chat = await prisma.whatsAppChat.upsert({
        where: { jid },
        update: {
            phone,
            name: getChatName(jid, pushName),
            lastMessage: text,
            lastMessageAt: createdAt,
            unreadCount: fromMe ? 0 : { increment: 1 },
        },
        create: {
            jid,
            phone,
            name: getChatName(jid, pushName),
            lastMessage: text,
            lastMessageAt: createdAt,
            unreadCount: fromMe ? 0 : 1,
        },
    });

    try {
        const savedMessage = await prisma.whatsAppMessage.create({
            data: {
                chatId: chat.id,
                messageId,
                direction,
                fromMe,
                text,
                mediaUrl,
                mediaType,
                mediaMimeType,
                fileName,
                status: fromMe ? 'SENT' : 'RECEIVED',
                sentBy,
                createdAt,
            },
            include: { chat: true },
        });

        if (io) {
            io.emit('whatsapp:message', savedMessage);
            io.emit('whatsapp:chat-updated', savedMessage.chat);
        }

        return savedMessage;
    } catch (error) {
        if (error.code === 'P2002') return null;
        throw error;
    }
};

export const setSocketIO = (socketIoInstance) => {
    io = socketIoInstance;
};

export const getStatus = () => ({
    status: connectionStatus,
    connected: Boolean(sock?.user && connectionStatus === 'READY'),
    user: sock?.user || null,
    hasQr: Boolean(latestQr),
    isInitializing,
    lastError,
    authDir: activeAuthDir,
});

export const getLatestQr = () => latestQr;

export const initialize = async () => {
    if (isInitializing) return getStatus();

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    isInitializing = true;
    connectionStatus = 'INITIALIZING';
    latestQr = null;
    lastError = null;
    emitStatus();

    try {
        logger.info('Initializing WhatsApp Service (Baileys)...');
        const authDir = await ensureActiveAuthDir();
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
            browser: ['Tecnotitlan', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            markOnlineOnConnect: false,
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                latestQr = qr;
                connectionStatus = 'QR_RECEIVED';
                logger.info('QR Code received');
                emitQr(qr);
                emitStatus();
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                lastError = lastDisconnect?.error?.message || `Conexion cerrada${statusCode ? ` (${statusCode})` : ''}`;
                const shouldReconnect = !resetInProgress && statusCode !== DisconnectReason.loggedOut;
                logger.warn(`WhatsApp connection closed. Reconnecting: ${shouldReconnect}. Reason: ${lastError}`);
                connectionStatus = shouldReconnect ? 'RECONNECTING' : 'DISCONNECTED';
                isInitializing = false;
                emitStatus();

                if (shouldReconnect) {
                    reconnectTimer = setTimeout(() => initialize().catch((error) => logger.error(`[WhatsApp] Reconnect failed: ${error.message}`)), 5000);
                }
            }

            if (connection === 'open') {
                latestQr = null;
                connectionStatus = 'READY';
                isInitializing = false;
                lastError = null;
                logger.info('WhatsApp connection opened');
                emitStatus();
            }
        });

        sock.ev.on('messages.upsert', async ({ messages = [] }) => {
            for (const message of messages) {
                const jid = message.key?.remoteJid;
                if (!jid || ignoredJids.has(jid) || jid.endsWith('@g.us')) continue;

                try {
                    const media = await extractIncomingMedia(message, jid);
                    const text = getMessageText(message) || getMediaLabel(media);
                    await persistMessage({
                        jid,
                        messageId: message.key?.id,
                        text,
                        fromMe: Boolean(message.key?.fromMe),
                        pushName: message.pushName,
                        createdAt: getMessageDate(message.messageTimestamp),
                        ...media,
                    });
                } catch (error) {
                    logger.error(`[WhatsApp] No se pudo guardar mensaje: ${error.message}`);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        return getStatus();
    } catch (error) {
        connectionStatus = 'ERROR';
        isInitializing = false;
        emitStatus();
        logger.error(`[WhatsApp] No se pudo inicializar: ${error.message}`);
        throw error;
    }
};

export const getClient = () => sock;

export const resetSession = async () => {
    resetInProgress = true;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    latestQr = null;
    lastError = null;
    isInitializing = false;
    connectionStatus = 'RESETTING';
    emitStatus();

    try {
        sock?.end?.(new Error('WhatsApp session reset requested'));
        sock?.ws?.close?.();
    } catch (error) {
        logger.warn(`[WhatsApp] No se pudo cerrar socket antes de reset: ${error.message}`);
    }

    sock = undefined;
    await delay(1200);

    const authDir = await rotateActiveAuthDir();
    logger.warn(`[WhatsApp] Sesion nueva activa en ${authDir}. Se generara QR nuevo.`);

    resetInProgress = false;
    return initialize();
};

export const listChats = async () => {
    const chats = await prisma.whatsAppChat.findMany({
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
    });
    return chats;
};

export const listMessages = async (jid) => {
    const chat = await prisma.whatsAppChat.findUnique({ where: { jid } });
    if (!chat) return { chat: null, messages: [] };

    await prisma.whatsAppChat.update({
        where: { jid },
        data: { unreadCount: 0 },
    });

    const messages = await prisma.whatsAppMessage.findMany({
        where: { chatId: chat.id },
        orderBy: { createdAt: 'asc' },
        take: 300,
    });

    return { chat: { ...chat, unreadCount: 0 }, messages };
};

export const sendMessage = async (number, message, sentBy = null) => {
    if (!sock || connectionStatus !== 'READY') {
        throw new BadRequestError('WhatsApp no esta conectado. Escanea el QR desde Configuracion.');
    }

    const jid = toJid(number);
    const text = String(message || '').trim();
    if (!text) throw new BadRequestError('El mensaje no puede estar vacio.');

    const result = await sock.sendMessage(jid, { text });
    await persistMessage({
        jid,
        messageId: result?.key?.id,
        text,
        fromMe: true,
        createdAt: new Date(),
        sentBy,
    });

    return result;
};

const getOutgoingMediaPayload = (file, caption = '') => {
    const mimeType = file?.mimetype || 'application/octet-stream';
    const fileName = file?.originalname || 'archivo';
    const cleanCaption = String(caption || '').trim();

    if (mimeType.startsWith('image/')) {
        return { payload: { image: file.buffer, mimetype: mimeType, caption: cleanCaption }, type: 'image' };
    }
    if (mimeType.startsWith('video/')) {
        return { payload: { video: file.buffer, mimetype: mimeType, caption: cleanCaption }, type: 'video' };
    }
    if (mimeType.startsWith('audio/')) {
        return { payload: { audio: file.buffer, mimetype: mimeType }, type: 'audio' };
    }
    return {
        payload: {
            document: file.buffer,
            mimetype: mimeType,
            fileName,
            caption: cleanCaption,
        },
        type: 'document',
    };
};

export const sendMediaMessage = async (number, file, caption = '', sentBy = null) => {
    if (!sock || connectionStatus !== 'READY') {
        throw new BadRequestError('WhatsApp no esta conectado. Escanea el QR desde Configuracion.');
    }
    if (!file?.buffer?.length) throw new BadRequestError('Selecciona un archivo para enviar.');

    const jid = toJid(number);
    const cleanCaption = String(caption || '').trim();
    const { payload, type } = getOutgoingMediaPayload(file, cleanCaption);
    const savedMedia = await saveMediaBuffer({
        buffer: file.buffer,
        jid,
        type,
        mimeType: file.mimetype,
        fileName: file.originalname,
    });

    const result = await sock.sendMessage(jid, payload);
    await persistMessage({
        jid,
        messageId: result?.key?.id,
        text: cleanCaption || getMediaLabel(savedMedia),
        fromMe: true,
        createdAt: new Date(),
        sentBy,
        ...savedMedia,
    });

    return result;
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

        if (adminWhatsappNumber && sock && connectionStatus === 'READY') {
            await sendMessage(adminWhatsappNumber, message, 'Sistema');
        } else if (adminWhatsappNumber) {
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
