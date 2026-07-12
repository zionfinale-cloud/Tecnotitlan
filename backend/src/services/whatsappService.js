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
let evolutionStatus = {
    provider: 'evolution',
    status: 'DISCONNECTED',
    connected: false,
    user: null,
    hasQr: false,
    isInitializing: false,
    lastError: null,
    instance: null,
    qr: null,
    webhookUrl: null,
};

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

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const getWhatsAppProvider = () => String(
    getConfig().WHATSAPP_PROVIDER
    || process.env.WHATSAPP_PROVIDER
    || 'baileys',
).trim().toLowerCase();

const isEvolutionProvider = () => getWhatsAppProvider() === 'evolution';

const getApiPublicUrl = () => trimTrailingSlash(
    getConfig().API_PUBLIC_URL
    || process.env.API_PUBLIC_URL
    || 'https://api.tecnotitlan.com.mx',
);

const getEvolutionConfig = () => {
    const config = getConfig();
    const apiUrl = trimTrailingSlash(config.EVOLUTION_API_URL || process.env.EVOLUTION_API_URL || '');
    const apiKey = config.EVOLUTION_API_KEY || process.env.EVOLUTION_API_KEY || '';
    const instance = config.EVOLUTION_INSTANCE || process.env.EVOLUTION_INSTANCE || 'tecnotitlan';
    const webhookSecret = config.EVOLUTION_WEBHOOK_SECRET || process.env.EVOLUTION_WEBHOOK_SECRET || '';
    const explicitWebhookUrl = config.EVOLUTION_WEBHOOK_URL || process.env.EVOLUTION_WEBHOOK_URL;
    const defaultWebhookUrl = `${getApiPublicUrl()}/api/integrations/whatsapp/evolution/webhook`;
    const webhookUrl = explicitWebhookUrl
        || (webhookSecret ? `${defaultWebhookUrl}?secret=${encodeURIComponent(webhookSecret)}` : defaultWebhookUrl);

    return {
        apiUrl,
        apiKey,
        instance,
        webhookUrl,
        webhookSecret,
    };
};

const maskEvolutionWebhookUrl = (url = '') => String(url || '').replace(/([?&]secret=)[^&]+/i, '$1********');

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

const getJidUser = (jid = '') => String(jid || '').split('@')[0] || '';
const isPhoneJid = (jid = '') => String(jid || '').endsWith('@s.whatsapp.net') && /^\d{8,15}$/.test(getJidUser(jid));
const isLidJid = (jid = '') => String(jid || '').endsWith('@lid');
const getPhoneFromJid = (jid = '') => (isPhoneJid(jid) ? getJidUser(jid) : null);

const getPhoneForProvider = (value = '') => {
    const rawValue = String(value || '');
    const phone = rawValue.includes('@') ? getJidUser(rawValue) : rawValue;
    const digits = normalizePhone(phone);
    if (!digits) throw new BadRequestError('El numero de WhatsApp es requerido.');
    return digits;
};

const getJidForPhone = (value = '') => {
    if (String(value || '').includes('@')) return value;
    return toJid(value);
};

const evolutionRequest = async (method, resourcePath, data = undefined, options = {}) => {
    const { apiUrl, apiKey } = getEvolutionConfig();
    if (!apiUrl || !apiKey) {
        throw new BadRequestError('Configura EVOLUTION_API_URL y EVOLUTION_API_KEY antes de usar Evolution API.');
    }

    const response = await axios({
        method,
        url: `${apiUrl}${resourcePath}`,
        headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        data,
        timeout: options.timeout || 25000,
    });

    return response.data;
};

const unwrapEvolutionData = (payload) => payload?.data || payload?.response || payload || {};

const extractEvolutionQr = (payload = {}) => {
    const data = unwrapEvolutionData(payload);
    const candidates = [
        payload?.qrcode?.base64,
        payload?.qrcode?.code,
        payload?.base64,
        payload?.code,
        payload?.qr,
        data?.qrcode?.base64,
        data?.qrcode?.code,
        data?.base64,
        data?.code,
        data?.qr,
    ].filter((value) => typeof value === 'string' && value.trim());

    const qr = candidates[0]?.trim();
    if (!qr) return null;
    if (qr.startsWith('data:image/')) return qr;
    if (/^[A-Za-z0-9+/=]{400,}$/.test(qr)) return `data:image/png;base64,${qr}`;
    return qr;
};

const getEvolutionState = (payload = {}) => {
    const data = unwrapEvolutionData(payload);
    return String(
        payload?.instance?.state
        || payload?.state
        || data?.instance?.state
        || data?.state
        || data?.connection
        || '',
    ).toLowerCase();
};

const updateEvolutionStatus = (patch = {}) => {
    const { instance, webhookUrl } = getEvolutionConfig();
    const nextQr = Object.prototype.hasOwnProperty.call(patch, 'qr') ? patch.qr : evolutionStatus.qr;
    evolutionStatus = {
        ...evolutionStatus,
        provider: 'evolution',
        instance,
        webhookUrl: maskEvolutionWebhookUrl(webhookUrl),
        ...patch,
        qr: nextQr,
        hasQr: Boolean(nextQr),
    };
    emitStatus();
    return evolutionStatus;
};

const refreshEvolutionStatus = async () => {
    const { instance } = getEvolutionConfig();
    try {
        const payload = await evolutionRequest('get', `/instance/connectionState/${encodeURIComponent(instance)}`);
        const state = getEvolutionState(payload);
        const connected = ['open', 'connected', 'ready'].includes(state);
        return updateEvolutionStatus({
            status: connected ? 'READY' : (state ? state.toUpperCase() : 'DISCONNECTED'),
            connected,
            user: unwrapEvolutionData(payload)?.instance || null,
            isInitializing: false,
            lastError: null,
            qr: connected ? null : evolutionStatus.qr,
        });
    } catch (error) {
        return updateEvolutionStatus({
            status: 'DISCONNECTED',
            connected: false,
            isInitializing: false,
            lastError: error.response?.data?.message || error.message,
        });
    }
};

const configureEvolutionWebhook = async () => {
    const { instance, webhookUrl } = getEvolutionConfig();
    if (!webhookUrl) return null;

    const payloads = [
        {
            webhook: {
                enabled: true,
                url: webhookUrl,
                byEvents: false,
                base64: true,
                events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
            },
        },
        {
            enabled: true,
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: true,
            events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
    ];

    for (const payload of payloads) {
        try {
            return await evolutionRequest('post', `/webhook/set/${encodeURIComponent(instance)}`, payload);
        } catch (error) {
            logger.warn(`[Evolution] No se pudo configurar webhook con formato ${payload.webhook ? 'v2' : 'simple'}: ${error.message}`);
        }
    }

    return null;
};

const resolveChatIdentity = (message = {}) => {
    const key = message.key || {};
    const candidates = [
        key.remoteJid,
        key.participant,
        message.participant,
    ].filter(Boolean);
    const phoneJid = candidates.find(isPhoneJid);
    const jid = key.remoteJid || phoneJid || candidates[0];

    return {
        jid,
        phone: phoneJid ? getPhoneFromJid(phoneJid) : getPhoneFromJid(jid),
    };
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

const waitForReady = async (timeoutMs = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (sock?.user && connectionStatus === 'READY') return true;
        if (connectionStatus === 'QR_RECEIVED') return false;
        await delay(500);
    }
    return sock?.user && connectionStatus === 'READY';
};

const ensureReadyForNotification = async () => {
    if (isEvolutionProvider()) {
        const status = await refreshEvolutionStatus();
        return Boolean(status.connected);
    }

    if (sock?.user && connectionStatus === 'READY') return true;

    if (!isInitializing && !['INITIALIZING', 'RECONNECTING', 'QR_RECEIVED'].includes(connectionStatus)) {
        initialize().catch((error) => logger.warn(`[WhatsApp] Reconexion automatica fallida: ${error.message}`));
    }

    return waitForReady();
};

const getDisconnectStatusCode = (lastDisconnect) => lastDisconnect?.error?.output?.statusCode
    || lastDisconnect?.error?.statusCode
    || lastDisconnect?.error?.data?.statusCode
    || null;

const isLoggedOutDisconnect = (lastDisconnect, statusCode, message = '') => {
    const lowerMessage = String(message || lastDisconnect?.error?.message || '').toLowerCase();
    return statusCode === DisconnectReason.loggedOut
        || lowerMessage.includes('logged out')
        || lowerMessage.includes('multidevice mismatch')
        || lowerMessage.includes('bad session');
};

const rotateSessionAndRequestQr = (reason) => {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    reconnectTimer = setTimeout(async () => {
        try {
            const authDir = await rotateActiveAuthDir();
            logger.warn(`[WhatsApp] Sesion invalida. Se activo una sesion nueva en ${authDir} para generar QR. Motivo: ${reason}`);
            await initialize();
        } catch (error) {
            connectionStatus = 'ERROR';
            lastError = error.message;
            isInitializing = false;
            emitStatus();
            logger.error(`[WhatsApp] No se pudo generar una sesion nueva: ${error.message}`);
        }
    }, 1500);
};

const getMessageDate = (timestamp) => {
    if (!timestamp) return new Date();
    const value = typeof timestamp === 'number'
        ? timestamp
        : Number(timestamp?.low || timestamp?.toString?.() || Date.now() / 1000);
    return new Date(value * 1000);
};

const getChatName = (jid, pushName, phone) => {
    if (pushName) return pushName;
    if (phone) return `+${phone}`;
    if (isLidJid(jid)) return `ID WhatsApp ${getJidUser(jid).slice(-6)}`;
    return jid || 'Cliente';
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
    phone,
}) => {
    if (!jid || ignoredJids.has(jid) || jid.endsWith('@g.us')) return null;

    const direction = fromMe ? 'OUTGOING' : 'INCOMING';
    const resolvedPhone = phone || getPhoneFromJid(jid);
    const resolvedName = getChatName(jid, pushName, resolvedPhone);
    const chatUpdate = {
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        ...(pushName ? { name: resolvedName } : {}),
        lastMessage: text,
        lastMessageAt: createdAt,
        unreadCount: fromMe ? 0 : { increment: 1 },
    };

    const chat = await prisma.whatsAppChat.upsert({
        where: { jid },
        update: chatUpdate,
        create: {
            jid,
            phone: resolvedPhone,
            name: resolvedName,
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

const getBaileysStatus = () => ({
    provider: 'baileys',
    status: connectionStatus,
    connected: Boolean(sock?.user && connectionStatus === 'READY'),
    user: sock?.user || null,
    hasQr: Boolean(latestQr),
    isInitializing,
    lastError,
    authDir: activeAuthDir,
});

export const getStatus = () => (isEvolutionProvider()
    ? {
        ...evolutionStatus,
        provider: 'evolution',
        instance: getEvolutionConfig().instance,
        webhookUrl: maskEvolutionWebhookUrl(getEvolutionConfig().webhookUrl),
    }
    : getBaileysStatus());

export const getLatestQr = () => (isEvolutionProvider() ? evolutionStatus.qr : latestQr);

const initializeEvolution = async () => {
    if (evolutionStatus.isInitializing) return getStatus();

    updateEvolutionStatus({
        status: 'INITIALIZING',
        connected: false,
        isInitializing: true,
        lastError: null,
        qr: null,
    });

    const { instance } = getEvolutionConfig();

    try {
        logger.info(`[Evolution] Inicializando instancia ${instance}...`);

        let currentStatus = await refreshEvolutionStatus();
        if (currentStatus.connected) return currentStatus;

        try {
            await evolutionRequest('post', '/instance/create', {
                instanceName: instance,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS',
            });
        } catch (error) {
            const message = error.response?.data?.message || error.message;
            if (!String(message).toLowerCase().includes('exist')) {
                logger.warn(`[Evolution] No se pudo crear instancia automaticamente: ${message}`);
            }
        }

        await configureEvolutionWebhook();

        const connectPayload = await evolutionRequest('get', `/instance/connect/${encodeURIComponent(instance)}`);
        const qr = extractEvolutionQr(connectPayload);
        latestQr = qr;

        currentStatus = await refreshEvolutionStatus();
        if (currentStatus.connected) return currentStatus;

        if (qr) {
            emitQr(qr);
            return updateEvolutionStatus({
                status: 'QR_RECEIVED',
                connected: false,
                isInitializing: false,
                lastError: null,
                qr,
            });
        }

        return updateEvolutionStatus({
            status: 'RECONNECTING',
            connected: false,
            isInitializing: false,
            lastError: 'Evolution no devolvio QR. Revisa si la instancia ya esta conectada o si el endpoint /instance/connect responde.',
            qr: null,
        });
    } catch (error) {
        return updateEvolutionStatus({
            status: 'ERROR',
            connected: false,
            isInitializing: false,
            lastError: error.response?.data?.message || error.message,
            qr: null,
        });
    }
};

export const initialize = async () => {
    if (isEvolutionProvider()) return initializeEvolution();

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
                const statusCode = getDisconnectStatusCode(lastDisconnect);
                lastError = lastDisconnect?.error?.message || `Conexion cerrada${statusCode ? ` (${statusCode})` : ''}`;
                const loggedOut = isLoggedOutDisconnect(lastDisconnect, statusCode, lastError);
                const shouldReconnect = !resetInProgress && !loggedOut;
                const shouldRequestQr = !resetInProgress && loggedOut;
                logger.warn(`WhatsApp connection closed. Reconnecting: ${shouldReconnect}. Request QR: ${shouldRequestQr}. StatusCode: ${statusCode || 'n/a'}. Reason: ${lastError}`);
                connectionStatus = shouldReconnect || shouldRequestQr ? 'RECONNECTING' : 'DISCONNECTED';
                isInitializing = false;
                emitStatus();

                if (shouldReconnect) {
                    reconnectTimer = setTimeout(() => initialize().catch((error) => logger.error(`[WhatsApp] Reconnect failed: ${error.message}`)), 5000);
                } else if (shouldRequestQr) {
                    rotateSessionAndRequestQr(lastError);
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
                const { jid, phone } = resolveChatIdentity(message);
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
                        phone,
                        createdAt: getMessageDate(message.messageTimestamp),
                        ...media,
                    });
                } catch (error) {
                    logger.error(`[WhatsApp] No se pudo guardar mensaje: ${error.message}`);
                }
            }
        });

        sock.ev.on('chats.phoneNumberShare', async ({ lid, jid }) => {
            const phone = getPhoneFromJid(jid);
            if (!lid || !phone) return;

            try {
                await prisma.whatsAppChat.updateMany({
                    where: { jid: lid },
                    data: { phone },
                });
            } catch (error) {
                logger.warn(`[WhatsApp] No se pudo asociar telefono ${phone} con ${lid}: ${error.message}`);
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

const resetEvolutionSession = async () => {
    const { instance } = getEvolutionConfig();
    updateEvolutionStatus({
        status: 'RESETTING',
        connected: false,
        isInitializing: true,
        lastError: null,
        qr: null,
    });

    try {
        await evolutionRequest('delete', `/instance/logout/${encodeURIComponent(instance)}`);
    } catch (error) {
        logger.warn(`[Evolution] Logout omitido o no soportado: ${error.response?.data?.message || error.message}`);
    }

    return initializeEvolution();
};

export const resetSession = async () => {
    if (isEvolutionProvider()) return resetEvolutionSession();

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

const sendEvolutionTextMessage = async (number, message, sentBy = null) => {
    const { instance } = getEvolutionConfig();
    const text = String(message || '').trim();
    if (!text) throw new BadRequestError('El mensaje no puede estar vacio.');

    const phone = getPhoneForProvider(number);
    const jid = getJidForPhone(String(number || '').includes('@') ? number : phone);
    const result = await evolutionRequest('post', `/message/sendText/${encodeURIComponent(instance)}`, {
        number: phone,
        text,
    });

    await persistMessage({
        jid,
        messageId: unwrapEvolutionData(result)?.key?.id || unwrapEvolutionData(result)?.id || `evo-out-${Date.now()}`,
        text,
        fromMe: true,
        phone,
        createdAt: new Date(),
        sentBy,
    });

    await refreshEvolutionStatus();
    return result;
};

export const sendMessage = async (number, message, sentBy = null) => {
    if (isEvolutionProvider()) return sendEvolutionTextMessage(number, message, sentBy);

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

const sendEvolutionMediaMessage = async (number, file, caption = '', sentBy = null) => {
    if (!file?.buffer?.length) throw new BadRequestError('Selecciona un archivo para enviar.');

    const { instance } = getEvolutionConfig();
    const phone = getPhoneForProvider(number);
    const jid = getJidForPhone(String(number || '').includes('@') ? number : phone);
    const cleanCaption = String(caption || '').trim();
    const mimeType = file.mimetype || 'application/octet-stream';
    const fileName = file.originalname || 'archivo';
    const mediaType = mimeType.startsWith('image/')
        ? 'image'
        : mimeType.startsWith('video/')
            ? 'video'
            : mimeType.startsWith('audio/')
                ? 'audio'
                : 'document';

    const savedMedia = await saveMediaBuffer({
        buffer: file.buffer,
        jid,
        type: mediaType,
        mimeType,
        fileName,
    });

    const result = await evolutionRequest('post', `/message/sendMedia/${encodeURIComponent(instance)}`, {
        number: phone,
        mediatype: mediaType,
        mimetype: mimeType,
        caption: cleanCaption,
        media: file.buffer.toString('base64'),
        fileName,
    });

    await persistMessage({
        jid,
        messageId: unwrapEvolutionData(result)?.key?.id || unwrapEvolutionData(result)?.id || `evo-media-${Date.now()}`,
        text: cleanCaption || getMediaLabel(savedMedia),
        fromMe: true,
        phone,
        createdAt: new Date(),
        sentBy,
        ...savedMedia,
    });

    return result;
};

export const sendMediaMessage = async (number, file, caption = '', sentBy = null) => {
    if (isEvolutionProvider()) return sendEvolutionMediaMessage(number, file, caption, sentBy);

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

const getEvolutionRemoteJid = (message = {}) => {
    const candidate = message?.key?.remoteJid
        || message?.remoteJid
        || message?.chatId
        || message?.jid
        || message?.from
        || message?.sender
        || message?.number;
    if (!candidate) return null;
    if (String(candidate).includes('@')) return candidate;
    return toJid(candidate);
};

const getEvolutionMessageId = (message = {}) => message?.key?.id
    || message?.id
    || message?.messageId
    || `evo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getEvolutionMessageTimestamp = (message = {}) => {
    const raw = message?.messageTimestamp || message?.timestamp || message?.date_time || message?.createdAt;
    if (!raw) return new Date();
    if (raw instanceof Date) return raw;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return new Date(numeric > 1000000000000 ? numeric : numeric * 1000);
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getEvolutionText = (message = {}) => {
    const content = unwrapMessageContent(message?.message || message || {});
    return message?.text
        || message?.body
        || message?.messageText
        || content?.conversation
        || content?.extendedTextMessage?.text
        || content?.imageMessage?.caption
        || content?.videoMessage?.caption
        || content?.documentMessage?.caption
        || content?.buttonsResponseMessage?.selectedDisplayText
        || content?.listResponseMessage?.title
        || null;
};

const getEvolutionMedia = async (message = {}, jid) => {
    const content = unwrapMessageContent(message?.message || message || {});
    const definition = mediaTypeDefinitions.find((item) => content[item.key]);
    const media = definition ? content[definition.key] : null;
    const base64 = message?.base64
        || message?.media
        || media?.base64
        || media?.jpegThumbnail;

    if (!definition || !base64 || typeof base64 !== 'string') return null;

    const cleanBase64 = base64.includes(',') ? base64.split(',').pop() : base64;
    try {
        return saveMediaBuffer({
            buffer: Buffer.from(cleanBase64, 'base64'),
            jid,
            type: definition.type,
            mimeType: media?.mimetype || message?.mimetype || 'application/octet-stream',
            fileName: media?.fileName || message?.fileName,
            messageId: getEvolutionMessageId(message),
        });
    } catch (error) {
        logger.warn(`[Evolution] No se pudo guardar adjunto entrante: ${error.message}`);
        return null;
    }
};

export const handleEvolutionWebhook = async (payload = {}) => {
    const event = String(payload?.event || payload?.type || '').toUpperCase();
    const data = payload?.data || payload;

    if (event.includes('CONNECTION') || data?.state || data?.instance?.state) {
        const state = getEvolutionState(payload);
        const connected = ['open', 'connected', 'ready'].includes(state);
        updateEvolutionStatus({
            status: connected ? 'READY' : (state ? state.toUpperCase() : 'DISCONNECTED'),
            connected,
            isInitializing: false,
            lastError: connected ? null : evolutionStatus.lastError,
            qr: connected ? null : evolutionStatus.qr,
            user: data?.instance || evolutionStatus.user,
        });
    }

    const rawMessages = Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data)
            ? data
            : [data];

    let processedMessages = 0;
    for (const message of rawMessages) {
        const jid = getEvolutionRemoteJid(message);
        if (!jid || ignoredJids.has(jid) || jid.endsWith('@g.us')) continue;

        const fromMe = Boolean(message?.key?.fromMe || message?.fromMe);
        const media = await getEvolutionMedia(message, jid);
        const text = getEvolutionText(message) || getMediaLabel(media);

        try {
            const saved = await persistMessage({
                jid,
                messageId: getEvolutionMessageId(message),
                text,
                fromMe,
                pushName: message?.pushName || message?.senderName || message?.name,
                phone: getPhoneForProvider(jid),
                createdAt: getEvolutionMessageTimestamp(message),
                ...media,
            });
            if (saved) processedMessages += 1;
        } catch (error) {
            logger.error(`[Evolution] No se pudo guardar mensaje webhook: ${error.message}`);
        }
    }

    return { processedMessages, event: event || 'UNKNOWN' };
};

const currency = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
});

const getOrderNumber = (order) => order?.orderNumber || order?.id || 'sin folio';

const getOrderTrackingUrl = (order) => {
    const clientUrl = getConfig().CLIENT_URL_PRIMARY || 'https://tecnotitlan.com.mx';
    return `${clientUrl}/order/${order?.id}`;
};

const getCustomerPhone = (order) => {
    const rawPhone = order?.shippingAddress?.whatsapp
        || order?.shippingAddress?.phone
        || order?.shippingAddress?.telefono
        || order?.user?.phone
        || null;

    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `52${digits}`;
    return digits;
};

const buildItemsSummary = (order) => {
    const items = order?.orderItems || [];
    if (!items.length) return '';

    return items
        .slice(0, 4)
        .map((item) => {
            const productName = item.name || item.product?.name || item.productName || 'Producto';
            return `- ${item.qty || 1} x ${productName}`;
        })
        .join('\n');
};

const sendCustomerOrderMessage = async (order, messageBuilder, eventName) => {
    const orderNumber = getOrderNumber(order);

    try {
        const phone = getCustomerPhone(order);
        if (!phone) {
            logger.warn(`[WhatsApp] ${eventName} omitido para ${orderNumber}: pedido sin telefono/WhatsApp de cliente.`);
            return;
        }

        const isReady = await ensureReadyForNotification();
        if (!isReady) {
            logger.warn(`[WhatsApp] ${eventName} omitido para ${orderNumber}: WhatsApp no conectado.`);
            return;
        }

        await sendMessage(phone, messageBuilder(order), 'Sistema');
        logger.info(`[WhatsApp] ${eventName} enviado para ${orderNumber} a ${phone}`);
    } catch (error) {
        logger.error(`[WhatsApp] No se pudo enviar ${eventName} para ${orderNumber}: ${error.message}`);
    }
};

export const sendCustomerOrderPaidNotification = async (order) => sendCustomerOrderMessage(
    order,
    (currentOrder) => {
        const itemsText = buildItemsSummary(currentOrder);
        return [
            'Hola, tu pago en Tecnotitlan fue confirmado.',
            `Pedido: ${getOrderNumber(currentOrder)}`,
            `Total: ${currency.format(currentOrder?.totalPrice || 0)}`,
            itemsText ? `\nProductos:\n${itemsText}` : '',
            `\nPuedes revisar el seguimiento aqui: ${getOrderTrackingUrl(currentOrder)}`,
        ].filter(Boolean).join('\n');
    },
    'aviso de pago al cliente'
);

export const sendCustomerOrderShippedNotification = async (order) => sendCustomerOrderMessage(
    order,
    (currentOrder) => {
        const trackingNumber = currentOrder?.shippingInfo?.trackingNumber || currentOrder?.shippingInfo?.tracking;
        const carrier = currentOrder?.shippingInfo?.carrier;
        const trackingUrl = currentOrder?.shippingInfo?.trackingUrl;

        return [
            'Tu pedido Tecnotitlan ya va en camino.',
            `Pedido: ${getOrderNumber(currentOrder)}`,
            trackingNumber ? `Guia: ${trackingNumber}` : '',
            carrier ? `Paqueteria: ${carrier}` : '',
            trackingUrl ? `Rastreo: ${trackingUrl}` : `Seguimiento: ${getOrderTrackingUrl(currentOrder)}`,
        ].filter(Boolean).join('\n');
    },
    'aviso de envio al cliente'
);

export const sendCustomerOrderDeliveredNotification = async (order) => sendCustomerOrderMessage(
    order,
    (currentOrder) => [
        'Marcamos tu pedido Tecnotitlan como entregado.',
        `Pedido: ${getOrderNumber(currentOrder)}`,
        'Gracias por tu compra. Si necesitas soporte, escribenos por este medio o a hola@tecnotitlan.com.mx.',
        `Detalle: ${getOrderTrackingUrl(currentOrder)}`,
    ].join('\n'),
    'aviso de entrega al cliente'
);

export const sendCustomerOrderStatusNotification = async (order) => {
    const status = order?.status;
    if (status === 'SHIPPED') return sendCustomerOrderShippedNotification(order);
    if (status === 'DELIVERED') return sendCustomerOrderDeliveredNotification(order);
    if (status === 'CANCELLED') {
        return sendCustomerOrderMessage(
            order,
            (currentOrder) => [
                'Tu pedido Tecnotitlan fue actualizado.',
                `Pedido: ${getOrderNumber(currentOrder)}`,
                'Estado: Cancelado',
                'Si tienes dudas, escribenos por este medio o a hola@tecnotitlan.com.mx.',
            ].join('\n'),
            'aviso de cancelacion al cliente'
        );
    }
    return null;
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

        if (adminWhatsappNumber && await ensureReadyForNotification()) {
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
