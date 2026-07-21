import path from 'path';
import fs from 'fs/promises';
import * as baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import axios from 'axios';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { BadRequestError } from '../utils/errorUtils.js';
import { getConfig } from './configService.js';
import { clearDatabaseAuthState, useDatabaseAuthState } from './baileysDbAuthState.js';
import { writeNotificationLog } from './notificationLogService.js';

const {
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
} = baileys;
const makeWASocket = baileys.default || baileys.makeWASocket;

let sock;
let io;
let latestQr = null;
let connectionStatus = 'DISCONNECTED';
let isInitializing = false;
let lastError = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let resetInProgress = false;
let shutdownInProgress = false;

const ignoredJids = new Set(['status@broadcast']);
const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const DEFAULT_MAX_AUTO_RECONNECT_ATTEMPTS = 1;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30 * 60 * 1000;
const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_PAUSED_RETRY_AFTER_MS = 10 * 60 * 1000;
const SESSION_LOCK_STALE_MS = Number(process.env.WHATSAPP_SESSION_LOCK_STALE_MS || 2 * 60 * 1000);
const SESSION_LOCK_HEARTBEAT_MS = Number(process.env.WHATSAPP_SESSION_LOCK_HEARTBEAT_MS || 15000);
const INSTANCE_ID = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let autoConnectTimer = null;
let autoConnectStarted = false;
let pausedAt = null;
let sessionLockTimer = null;
let hasSessionLock = false;

const RELINK_STATUSES = new Set(['QR_REQUIRED', 'LOGGED_OUT']);

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

const getWhatsAppProvider = () => {
    const provider = String(
    getConfig().WHATSAPP_PROVIDER
    || process.env.WHATSAPP_PROVIDER
    || 'baileys',
    ).trim().toLowerCase();
    return ['disabled', 'off', 'none'].includes(provider) ? 'disabled' : 'baileys';
};

const isWhatsAppDisabledProvider = () => getWhatsAppProvider() === 'disabled';
const getBaileysAuthStorage = () => String(
    getConfig().WHATSAPP_AUTH_STORAGE
    || process.env.WHATSAPP_AUTH_STORAGE
    || 'database',
).trim().toLowerCase();
const isDatabaseAuthStorage = () => ['database', 'db', 'postgres', 'postgresql', 'supabase'].includes(getBaileysAuthStorage());
const isAutoConnectEnabled = () => String(
    getConfig().WHATSAPP_AUTO_CONNECT
    ?? process.env.WHATSAPP_AUTO_CONNECT
    ?? 'true',
).toLowerCase() !== 'false';

const getKeepAliveIntervalMs = () => {
    const rawValue = Number(
        getConfig().WHATSAPP_KEEP_ALIVE_INTERVAL_MS
        || process.env.WHATSAPP_KEEP_ALIVE_INTERVAL_MS
        || DEFAULT_KEEP_ALIVE_INTERVAL_MS,
    );
    return Number.isFinite(rawValue) && rawValue >= 15000 ? rawValue : DEFAULT_KEEP_ALIVE_INTERVAL_MS;
};

const getPausedRetryAfterMs = () => {
    const rawValue = Number(
        getConfig().WHATSAPP_PAUSED_RETRY_AFTER_MS
        || process.env.WHATSAPP_PAUSED_RETRY_AFTER_MS
        || DEFAULT_PAUSED_RETRY_AFTER_MS,
    );
    return Number.isFinite(rawValue) && rawValue >= 60000 ? rawValue : DEFAULT_PAUSED_RETRY_AFTER_MS;
};

const shouldAutoRetryPaused = () => String(
    getConfig().WHATSAPP_AUTO_RETRY_PAUSED
    ?? process.env.WHATSAPP_AUTO_RETRY_PAUSED
    ?? 'false',
).toLowerCase() === 'true';

const shouldAutoRotateSessionOnLogout = () => String(
    getConfig().WHATSAPP_AUTO_ROTATE_SESSION_ON_LOGOUT
    ?? process.env.WHATSAPP_AUTO_ROTATE_SESSION_ON_LOGOUT
    ?? 'false',
).toLowerCase() === 'true';

const getMaxAutoReconnectAttempts = () => {
    const rawValue = Number(
        getConfig().WHATSAPP_MAX_RECONNECT_ATTEMPTS
        ?? process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS
        ?? DEFAULT_MAX_AUTO_RECONNECT_ATTEMPTS,
    );
    return Number.isFinite(rawValue) && rawValue >= 0
        ? Math.min(rawValue, 3)
        : DEFAULT_MAX_AUTO_RECONNECT_ATTEMPTS;
};

const getReconnectBaseDelayMs = () => {
    const rawValue = Number(
        getConfig().WHATSAPP_RECONNECT_BASE_DELAY_MS
        ?? process.env.WHATSAPP_RECONNECT_BASE_DELAY_MS
        ?? DEFAULT_RECONNECT_BASE_DELAY_MS,
    );
    return Number.isFinite(rawValue) && rawValue >= 60000
        ? rawValue
        : DEFAULT_RECONNECT_BASE_DELAY_MS;
};

const getReconnectMaxDelayMs = () => {
    const baseDelayMs = getReconnectBaseDelayMs();
    const rawValue = Number(
        getConfig().WHATSAPP_RECONNECT_MAX_DELAY_MS
        ?? process.env.WHATSAPP_RECONNECT_MAX_DELAY_MS
        ?? DEFAULT_RECONNECT_MAX_DELAY_MS,
    );
    return Number.isFinite(rawValue) && rawValue >= baseDelayMs
        ? rawValue
        : DEFAULT_RECONNECT_MAX_DELAY_MS;
};

let activeAuthDir = null;
const BAILEYS_AUTH_PROVIDER = 'baileys';
let authSyncTimer = null;
let authSyncRunning = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isSafeAuthRelativePath = (relativePath = '') => {
    if (!relativePath || path.isAbsolute(relativePath)) return false;
    return !relativePath.split(/[\\/]/).includes('..');
};

const isJsonAuthFile = (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json');

const collectAuthJsonFiles = async (baseDir, currentDir = baseDir) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectAuthJsonFiles(baseDir, fullPath));
            continue;
        }
        if (!isJsonAuthFile(entry)) continue;

        try {
            const raw = await fs.readFile(fullPath, 'utf8');
            files.push({
                relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
                content: JSON.parse(raw),
            });
        } catch (error) {
            logger.warn(`[WhatsApp] No se pudo leer credencial ${fullPath}: ${error.message}`);
        }
    }

    return files;
};

const countAuthJsonFiles = async (authDir) => {
    const files = await collectAuthJsonFiles(authDir);
    return files.length;
};

const hasPersistedBaileysSession = async () => {
    if (isDatabaseAuthStorage()) {
        const creds = await prisma.whatsAppAuthState.findUnique({
            where: {
                provider_key: {
                    provider: BAILEYS_AUTH_PROVIDER,
                    key: 'creds',
                },
            },
            select: { id: true },
        });
        return Boolean(creds);
    }

    const authDir = await ensureActiveAuthDir();
    const filesOnDisk = await countAuthJsonFiles(authDir).catch(() => 0);
    if (filesOnDisk > 0) return true;

    const filesInDb = await prisma.whatsAppAuthFile.count({
        where: { provider: BAILEYS_AUTH_PROVIDER },
    });
    return filesInDb > 0;
};

const hydrateBaileysAuthFromDb = async (authDir) => {
    const filesOnDisk = await countAuthJsonFiles(authDir).catch(() => 0);
    if (filesOnDisk > 0) return;

    const rows = await prisma.whatsAppAuthFile.findMany({
        where: { provider: BAILEYS_AUTH_PROVIDER },
    });

    if (rows.length === 0) return;

    const base = path.resolve(authDir);
    for (const row of rows) {
        if (!isSafeAuthRelativePath(row.relativePath)) continue;
        const target = path.resolve(base, row.relativePath);
        if (!target.startsWith(`${base}${path.sep}`)) continue;

        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, JSON.stringify(row.content), 'utf8');
    }

    logger.info(`[WhatsApp] Sesion Baileys restaurada desde DB (${rows.length} archivos).`);
};

const syncBaileysAuthToDb = async (authDir) => {
    if (authSyncRunning) return;
    authSyncRunning = true;

    try {
        const files = await collectAuthJsonFiles(authDir);
        await Promise.all(files.map((file) => prisma.whatsAppAuthFile.upsert({
            where: {
                provider_relativePath: {
                    provider: BAILEYS_AUTH_PROVIDER,
                    relativePath: file.relativePath,
                },
            },
            create: {
                provider: BAILEYS_AUTH_PROVIDER,
                relativePath: file.relativePath,
                content: file.content,
            },
            update: {
                content: file.content,
            },
        })));

        if (files.length > 0) {
            logger.info(`[WhatsApp] Credenciales Baileys sincronizadas en DB (${files.length} archivos).`);
        }
    } finally {
        authSyncRunning = false;
    }
};

const scheduleBaileysAuthSync = (authDir) => {
    if (authSyncTimer) clearTimeout(authSyncTimer);
    authSyncTimer = setTimeout(() => {
        syncBaileysAuthToDb(authDir).catch((error) => {
            logger.warn(`[WhatsApp] No se pudo sincronizar sesion en DB: ${error.message}`);
        });
    }, 1500);
};

const clearReconnectTimer = () => {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
};

const getReconnectDelayMs = () => Math.min(
    getReconnectBaseDelayMs() * (2 ** reconnectAttempt),
    getReconnectMaxDelayMs(),
);

const sanitizeSessionName = (value) => {
    const safe = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || 'current';
};

const getActiveSessionFile = () => path.join(getBaseAuthDir(), 'active-session.txt');
const getSessionLockFile = () => path.join(getBaseAuthDir(), 'baileys-session.lock.json');

const readSessionLock = async () => {
    try {
        const raw = await fs.readFile(getSessionLockFile(), 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
};

const writeSessionLock = async () => {
    const baseDir = getBaseAuthDir();
    await fs.mkdir(baseDir, { recursive: true });
    await fs.writeFile(getSessionLockFile(), JSON.stringify({
        owner: INSTANCE_ID,
        pid: process.pid,
        updatedAt: new Date().toISOString(),
    }), 'utf8');
};

const stopSessionLockHeartbeat = () => {
    if (sessionLockTimer) {
        clearInterval(sessionLockTimer);
        sessionLockTimer = null;
    }
};

const startSessionLockHeartbeat = () => {
    stopSessionLockHeartbeat();
    sessionLockTimer = setInterval(() => {
        writeSessionLock().catch((error) => {
            logger.warn(`[WhatsApp] No se pudo actualizar lock de sesion: ${error.message}`);
        });
    }, SESSION_LOCK_HEARTBEAT_MS);
    sessionLockTimer.unref?.();
};

const acquireSessionLock = async () => {
    const currentLock = await readSessionLock();
    const lockAge = currentLock?.updatedAt ? Date.now() - new Date(currentLock.updatedAt).getTime() : Infinity;
    const lockIsFresh = Number.isFinite(lockAge) && lockAge < SESSION_LOCK_STALE_MS;

    if (currentLock?.owner && currentLock.owner !== INSTANCE_ID && lockIsFresh) {
        return {
            acquired: false,
            owner: currentLock.owner,
            ageMs: lockAge,
        };
    }

    await writeSessionLock();
    hasSessionLock = true;
    startSessionLockHeartbeat();
    return { acquired: true };
};

const releaseSessionLock = async () => {
    stopSessionLockHeartbeat();
    if (!hasSessionLock) return;

    try {
        const currentLock = await readSessionLock();
        if (currentLock?.owner === INSTANCE_ID) {
            await fs.rm(getSessionLockFile(), { force: true });
        }
    } catch (error) {
        logger.warn(`[WhatsApp] No se pudo liberar lock de sesion: ${error.message}`);
    } finally {
        hasSessionLock = false;
    }
};

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

const getOutgoingTargets = async (value = '') => {
    const requestedJid = toJid(String(value || ''));
    const targets = [requestedJid];

    try {
        const chat = await prisma.whatsAppChat.findUnique({
            where: { jid: requestedJid },
            select: { phone: true },
        });
        if (chat?.phone) {
            const phoneJid = toJid(chat.phone);
            if (!targets.includes(phoneJid)) targets.push(phoneJid);
        }
    } catch (error) {
        logger.warn(`[WhatsApp] No se pudo resolver telefono alterno para ${requestedJid}: ${error.message}`);
    }

    return { requestedJid, targets };
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

export const ensureReadyForNotification = async () => {
    if (isWhatsAppDisabledProvider()) return false;

    if (sock?.user && connectionStatus === 'READY') return true;
    if (!isAutoConnectEnabled()) return false;
    if (connectionStatus === 'PAUSED') return false;
    if (RELINK_STATUSES.has(connectionStatus)) return false;

    if (!isInitializing && !['INITIALIZING', 'RECONNECTING', 'QR_RECEIVED'].includes(connectionStatus)) {
        try {
            await initialize({ allowQr: false, reason: 'notification' });
        } catch (error) {
            logger.warn(`[WhatsApp] Reconexion automatica fallida: ${error.message}`);
            return false;
        }
    }

    return waitForReady(15000);
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

const isRestartRequiredDisconnect = (statusCode, message = '') => {
    const lowerMessage = String(message || '').toLowerCase();
    return statusCode === DisconnectReason.restartRequired
        || statusCode === 515
        || lowerMessage.includes('restart required');
};

const rotateSessionAndRequestQr = (reason) => {
    clearReconnectTimer();

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        try {
            if (isDatabaseAuthStorage()) {
                await clearDatabaseAuthState(BAILEYS_AUTH_PROVIDER);
                logger.warn(`[WhatsApp] Sesion invalida. Se limpio la sesion cifrada en PostgreSQL para generar QR. Motivo: ${reason}`);
            } else {
                const authDir = await rotateActiveAuthDir();
                logger.warn(`[WhatsApp] Sesion invalida. Se activo una sesion nueva en ${authDir} para generar QR. Motivo: ${reason}`);
            }
            await initialize({ allowQr: true, reason: 'rotar sesion manual' });
        } catch (error) {
            connectionStatus = 'ERROR';
            lastError = error.message;
            isInitializing = false;
            emitStatus();
            logger.error(`[WhatsApp] No se pudo generar una sesion nueva: ${error.message}`);
        }
    }, 1500);
};

const pauseBaileysForManualReview = (reason, statusCode = null) => {
    clearReconnectTimer();
    releaseSessionLock().catch((error) => {
        logger.warn(`[WhatsApp] No se pudo liberar lock al pausar sesion: ${error.message}`);
    });
    reconnectAttempt = 0;
    pausedAt = null;
    connectionStatus = 'LOGGED_OUT';
    isInitializing = false;
    lastError = [
        'WhatsApp cerro la sesion guardada.',
        reason || 'Sesion cerrada o invalida.',
        statusCode ? `Codigo: ${statusCode}.` : '',
        'Usa "Borrar sesion y pedir QR" solo cuando vayas a vincular un numero sano.',
    ].filter(Boolean).join(' ');
    logger.warn(`[WhatsApp] ${lastError}`);
    emitStatus();
};

const scheduleImmediateBaileysReconnect = (reason) => {
    if (reconnectTimer || resetInProgress || shutdownInProgress) return;

    connectionStatus = 'RECONNECTING';
    isInitializing = false;
    emitStatus();

    logger.warn(`[WhatsApp] Baileys solicito reinicio inmediato. Reintentando en 2s. Motivo: ${reason || 'restart required'}`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initialize({ allowQr: false, reason: 'baileys restart required' }).catch((error) => {
            lastError = error.message;
            logger.error(`[WhatsApp] Reconnect inmediato fallido: ${error.message}`);
            scheduleBaileysReconnect(error.message);
        });
    }, 2000);
    reconnectTimer.unref?.();
};

const scheduleBaileysReconnect = (reason) => {
    if (reconnectTimer || resetInProgress) return;

    const maxReconnectAttempts = getMaxAutoReconnectAttempts();
    if (reconnectAttempt >= maxReconnectAttempts) {
        connectionStatus = 'DISCONNECTED';
        pausedAt = null;
        reconnectAttempt = 0;
        lastError = `Reconexión detenida después de ${maxReconnectAttempts} intento(s). Último motivo: ${reason || 'desconocido'}`;
        logger.warn(`[WhatsApp] ${lastError}`);
        emitStatus();
        return;
    }

    const delayMs = getReconnectDelayMs();
    reconnectAttempt += 1;
    connectionStatus = 'RECONNECTING';
    emitStatus();

    logger.warn(`[WhatsApp] Reintento automatico ${reconnectAttempt}/${maxReconnectAttempts} en ${Math.round(delayMs / 1000)}s. Motivo: ${reason || 'desconocido'}`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initialize({ allowQr: false, reason: 'reconnect' }).catch((error) => {
            lastError = error.message;
            logger.error(`[WhatsApp] Reconnect failed: ${error.message}`);
            scheduleBaileysReconnect(error.message);
        });
    }, delayMs);
    reconnectTimer.unref?.();
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
    authStorage: getBaileysAuthStorage(),
    authDir: activeAuthDir,
    reconnectAttempt,
    maxReconnectAttempts: getMaxAutoReconnectAttempts(),
});

export const hasSavedSession = async () => {
    if (isWhatsAppDisabledProvider()) return false;
    return hasPersistedBaileysSession();
};

const getDisabledStatus = () => ({
    provider: 'disabled',
    status: 'DISABLED',
    connected: false,
    user: null,
    hasQr: false,
    isInitializing: false,
    lastError: 'WhatsApp esta desactivado para proteger el numero operativo. Activalo de nuevo solo cuando haya un canal estable.',
});

export const getStatus = () => {
    if (isWhatsAppDisabledProvider()) return getDisabledStatus();
    return getBaileysStatus();
};

export const getLatestQr = () => {
    if (isWhatsAppDisabledProvider()) return null;
    return latestQr;
};

export const initialize = async ({ allowQr = true, reason = 'manual' } = {}) => {
    if (isWhatsAppDisabledProvider()) {
        stopAutoConnectWatchdog();
        clearReconnectTimer();
        connectionStatus = 'DISABLED';
        isInitializing = false;
        latestQr = null;
        lastError = getDisabledStatus().lastError;
        emitStatus();
        return getStatus();
    }

    if (shutdownInProgress) return getStatus();

    if (sock?.user && connectionStatus === 'READY') return getStatus();
    if (isInitializing) return getStatus();

    const hasSavedSession = await hasPersistedBaileysSession();
    if (!allowQr && !hasSavedSession) {
        connectionStatus = 'DISCONNECTED';
        latestQr = null;
        lastError = `Auto connect omitido (${reason}): no hay sesion de WhatsApp guardada. Inicia la conexion manualmente desde Configuracion > WhatsApp QR.`;
        logger.warn(`[WhatsApp] ${lastError}`);
        emitStatus();
        return getStatus();
    }

    clearReconnectTimer();

    isInitializing = true;
    connectionStatus = 'INITIALIZING';
    latestQr = null;
    lastError = null;
    emitStatus();

    try {
        logger.info('Initializing WhatsApp Service (Baileys)...');
        const lock = await acquireSessionLock();
        if (!lock.acquired) {
            connectionStatus = 'WAITING_FOR_SESSION_LOCK';
            isInitializing = false;
            lastError = `Otra instancia mantiene la sesion de WhatsApp activa. Reintentando en modo seguro.`;
            logger.warn(`[WhatsApp] Inicializacion omitida: lock activo por ${lock.owner} (${Math.round((lock.ageMs || 0) / 1000)}s).`);
            emitStatus();
            scheduleBaileysReconnect('Sesion protegida por lock de despliegue');
            return getStatus();
        }

        let activeAuthDirForSync = null;
        let state;
        let saveCreds;

        if (isDatabaseAuthStorage()) {
            ({ state, saveCreds } = await useDatabaseAuthState(baileys, BAILEYS_AUTH_PROVIDER));
            activeAuthDir = 'database';
            logger.info('[WhatsApp] Usando sesion Baileys cifrada en PostgreSQL.');
        } else {
            const authDir = await ensureActiveAuthDir();
            activeAuthDirForSync = authDir;
            await hydrateBaileysAuthFromDb(authDir);
            ({ state, saveCreds } = await useMultiFileAuthState(authDir));
            logger.info(`[WhatsApp] Usando sesion Baileys en archivos: ${authDir}`);
        }

        const { version } = await fetchLatestBaileysVersion();

        const client = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Tecnotitlan', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            markOnlineOnConnect: false,
            syncFullHistory: false,
        });

        sock = client;

        client.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                if (!isDatabaseAuthStorage() && activeAuthDirForSync) {
                    scheduleBaileysAuthSync(activeAuthDirForSync);
                }
            } catch (error) {
                logger.warn(`[WhatsApp] No se pudo guardar/sincronizar credenciales: ${error.message}`);
            }
        });

        client.ev.on('connection.update', (update) => {
            if (sock !== client) return;

            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                if (!allowQr) {
                    latestQr = null;
                    reconnectAttempt = 0;
                    pausedAt = null;
                    connectionStatus = 'QR_REQUIRED';
                    isInitializing = false;
                    lastError = `WhatsApp requiere QR nuevo. No se generara automaticamente durante ${reason}; usa "Borrar sesion y pedir QR" solo cuando vayas a vincular un numero sano.`;
                    logger.warn(`[WhatsApp] ${lastError}`);
                    try {
                        client?.end?.(new Error('QR required during protected auto connect'));
                        client?.ws?.close?.();
                    } catch (error) {
                        logger.warn(`[WhatsApp] No se pudo cerrar socket tras QR protegido: ${error.message}`);
                    }
                    releaseSessionLock().catch((error) => {
                        logger.warn(`[WhatsApp] No se pudo liberar lock tras QR protegido: ${error.message}`);
                    });
                    emitStatus();
                    return;
                }
                latestQr = qr;
                connectionStatus = 'QR_RECEIVED';
                logger.info('QR Code received');
                emitQr(qr);
                emitStatus();
            }

            if (connection === 'close') {
                const statusCode = getDisconnectStatusCode(lastDisconnect);
                lastError = lastDisconnect?.error?.message || `Conexion cerrada${statusCode ? ` (${statusCode})` : ''}`;
                const restartRequired = isRestartRequiredDisconnect(statusCode, lastError);
                const loggedOut = isLoggedOutDisconnect(lastDisconnect, statusCode, lastError);
                const shouldReconnect = !shutdownInProgress && !resetInProgress && !loggedOut;
                const shouldRequestQr = !shutdownInProgress && !resetInProgress && loggedOut && shouldAutoRotateSessionOnLogout();
                logger.warn(`WhatsApp connection closed. Restart required: ${restartRequired}. Reconnecting: ${shouldReconnect}. Request QR: ${shouldRequestQr}. StatusCode: ${statusCode || 'n/a'}. Reason: ${lastError}`);
                sock = undefined;

                if (!shutdownInProgress && !resetInProgress && restartRequired) {
                    latestQr = null;
                    reconnectAttempt = 0;
                    scheduleImmediateBaileysReconnect(lastError);
                    return;
                }

                if (!shutdownInProgress && !resetInProgress && loggedOut && !shouldRequestQr) {
                    pauseBaileysForManualReview(lastError, statusCode);
                    return;
                }

                connectionStatus = shouldReconnect || shouldRequestQr ? 'RECONNECTING' : 'DISCONNECTED';
                isInitializing = false;
                emitStatus();

                if (shouldReconnect) {
                    scheduleBaileysReconnect(lastError);
                } else if (shouldRequestQr) {
                    rotateSessionAndRequestQr(lastError);
                }
            }

            if (connection === 'open') {
                latestQr = null;
                connectionStatus = 'READY';
                isInitializing = false;
                lastError = null;
                reconnectAttempt = 0;
                pausedAt = null;
                clearReconnectTimer();
                if (!isDatabaseAuthStorage() && activeAuthDirForSync) {
                    scheduleBaileysAuthSync(activeAuthDirForSync);
                }
                logger.info('WhatsApp connection opened');
                emitStatus();
            }
        });

        client.ev.on('messages.upsert', async ({ messages = [] }) => {
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

        client.ev.on('chats.phoneNumberShare', async ({ lid, jid }) => {
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
        return getStatus();
    } catch (error) {
        connectionStatus = 'ERROR';
        isInitializing = false;
        await releaseSessionLock();
        emitStatus();
        logger.error(`[WhatsApp] No se pudo inicializar: ${error.message}`);
        throw error;
    }
};

const shouldSkipAutoConnect = () => resetInProgress
    || isInitializing
    || Boolean(reconnectTimer)
    || connectionStatus === 'QR_RECEIVED'
    || RELINK_STATUSES.has(connectionStatus);

const attemptAutoConnect = async (reason = 'watchdog') => {
    if (!isAutoConnectEnabled()) return getStatus();
    if (isWhatsAppDisabledProvider()) return getStatus();

    if (sock?.user && connectionStatus === 'READY') return getStatus();

    if (connectionStatus === 'PAUSED') {
        if (!shouldAutoRetryPaused()) return getStatus();

        const elapsedMs = pausedAt ? Date.now() - pausedAt : getPausedRetryAfterMs();
        if (elapsedMs < getPausedRetryAfterMs()) return getStatus();

        reconnectAttempt = 0;
        pausedAt = null;
        connectionStatus = 'RECONNECTING';
        lastError = `Reintentando reconexion automatica tras pausa (${reason}).`;
        emitStatus();
    }

    if (shouldSkipAutoConnect()) return getStatus();

    logger.info(`[WhatsApp] Auto connect (${reason}) iniciando proveedor ${getWhatsAppProvider()}.`);
    return initialize({ allowQr: false, reason });
};

export const startAutoConnectWatchdog = () => {
    if (isWhatsAppDisabledProvider()) {
        connectionStatus = 'DISABLED';
        lastError = getDisabledStatus().lastError;
        logger.warn('[WhatsApp] Auto connect omitido: WHATSAPP_PROVIDER=disabled.');
        emitStatus();
        return;
    }

    if (!isAutoConnectEnabled()) {
        logger.warn('[WhatsApp] Auto connect omitido: WHATSAPP_AUTO_CONNECT=false.');
        emitStatus();
        return;
    }

    if (autoConnectStarted) return;
    autoConnectStarted = true;

    const tick = async () => {
        try {
            await attemptAutoConnect('watchdog');
        } catch (error) {
            logger.warn(`[WhatsApp] Watchdog no pudo conectar: ${error.message}`);
        } finally {
            if (!autoConnectStarted) return;
            autoConnectTimer = setTimeout(tick, getKeepAliveIntervalMs());
            autoConnectTimer.unref?.();
        }
    };

    autoConnectTimer = setTimeout(tick, 1500);
    autoConnectTimer.unref?.();
};

export const stopAutoConnectWatchdog = () => {
    autoConnectStarted = false;
    if (autoConnectTimer) {
        clearTimeout(autoConnectTimer);
        autoConnectTimer = null;
    }
};

export const shutdown = async () => {
    shutdownInProgress = true;
    stopAutoConnectWatchdog();
    clearReconnectTimer();

    if (authSyncTimer) {
        clearTimeout(authSyncTimer);
        authSyncTimer = null;
    }

    if (!isWhatsAppDisabledProvider() && !isDatabaseAuthStorage() && activeAuthDir) {
        await syncBaileysAuthToDb(activeAuthDir).catch((error) => {
            logger.warn(`[WhatsApp] No se pudo sincronizar sesion durante shutdown: ${error.message}`);
        });
    }

    try {
        sock?.ws?.close?.(1000, 'server shutdown');
        sock?.end?.(new Error('Server shutdown'));
    } catch (error) {
        logger.warn(`[WhatsApp] No se pudo cerrar socket durante shutdown: ${error.message}`);
    }

    sock = undefined;
    isInitializing = false;
    if (!resetInProgress) connectionStatus = 'DISCONNECTED';

    await releaseSessionLock();
    emitStatus();
    shutdownInProgress = false;
};

export const getClient = () => sock;

export const resetSession = async () => {
    if (isWhatsAppDisabledProvider()) return getStatus();

    resetInProgress = true;
    clearReconnectTimer();

    latestQr = null;
    lastError = null;
    reconnectAttempt = 0;
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

    if (isDatabaseAuthStorage()) {
        await clearDatabaseAuthState(BAILEYS_AUTH_PROVIDER);
        activeAuthDir = 'database';
        logger.warn('[WhatsApp] Sesion cifrada en PostgreSQL eliminada. Se generara QR nuevo.');
    } else {
        const authDir = await rotateActiveAuthDir();
        logger.warn(`[WhatsApp] Sesion nueva activa en ${authDir}. Se generara QR nuevo.`);
    }

    resetInProgress = false;
    return initialize({ allowQr: true, reason: 'reset manual' });
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
    if (isWhatsAppDisabledProvider()) {
        throw new BadRequestError('WhatsApp esta desactivado temporalmente. Usa correo o el panel de pedidos.');
    }

    if (!sock || connectionStatus !== 'READY') {
        throw new BadRequestError('WhatsApp no esta conectado. Escanea el QR desde Configuracion.');
    }

    const text = String(message || '').trim();
    if (!text) throw new BadRequestError('El mensaje no puede estar vacio.');

    const { requestedJid, targets } = await getOutgoingTargets(number);
    let result;
    let lastSendError;

    for (const targetJid of targets) {
        try {
            result = await sock.sendMessage(targetJid, { text });
            if (targetJid !== requestedJid) {
                logger.info(`[WhatsApp] Mensaje enviado usando telefono alterno para chat ${requestedJid}. Destino real: ${targetJid}`);
            }
            break;
        } catch (error) {
            lastSendError = error;
            logger.warn(`[WhatsApp] No se pudo enviar a ${targetJid}: ${error.message}`);
        }
    }

    if (!result) {
        throw new BadRequestError(`No se pudo enviar el mensaje por WhatsApp: ${lastSendError?.message || 'destino no disponible'}`);
    }

    await persistMessage({
        jid: requestedJid,
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
    if (isWhatsAppDisabledProvider()) {
        throw new BadRequestError('WhatsApp esta desactivado temporalmente. Usa correo o el panel de pedidos.');
    }

    if (!sock || connectionStatus !== 'READY') {
        throw new BadRequestError('WhatsApp no esta conectado. Escanea el QR desde Configuracion.');
    }
    if (!file?.buffer?.length) throw new BadRequestError('Selecciona un archivo para enviar.');

    const cleanCaption = String(caption || '').trim();
    const { payload, type } = getOutgoingMediaPayload(file, cleanCaption);
    const { requestedJid, targets } = await getOutgoingTargets(number);
    const savedMedia = await saveMediaBuffer({
        buffer: file.buffer,
        jid: requestedJid,
        type,
        mimeType: file.mimetype,
        fileName: file.originalname,
    });

    let result;
    let lastSendError;
    for (const targetJid of targets) {
        try {
            result = await sock.sendMessage(targetJid, payload);
            if (targetJid !== requestedJid) {
                logger.info(`[WhatsApp] Adjunto enviado usando telefono alterno para chat ${requestedJid}. Destino real: ${targetJid}`);
            }
            break;
        } catch (error) {
            lastSendError = error;
            logger.warn(`[WhatsApp] No se pudo enviar adjunto a ${targetJid}: ${error.message}`);
        }
    }

    if (!result) {
        throw new BadRequestError(`No se pudo enviar el adjunto por WhatsApp: ${lastSendError?.message || 'destino no disponible'}`);
    }

    await persistMessage({
        jid: requestedJid,
        messageId: result?.key?.id,
        text: cleanCaption || getMediaLabel(savedMedia),
        fromMe: true,
        createdAt: new Date(),
        sentBy,
        ...savedMedia,
    });

    return result;
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
    let phone = null;

    try {
        phone = getCustomerPhone(order);
        if (!phone) {
            logger.warn(`[WhatsApp] ${eventName} omitido para ${orderNumber}: pedido sin telefono/WhatsApp de cliente.`);
            await writeNotificationLog({
                channel: 'WHATSAPP',
                audience: 'CUSTOMER',
                event: eventName,
                status: 'SKIPPED',
                provider: getWhatsAppProvider(),
                order,
                message: 'Pedido sin telefono/WhatsApp de cliente.',
                details: { connectionStatus },
            });
            return;
        }

        const isReady = await ensureReadyForNotification();
        if (!isReady) {
            logger.warn(`[WhatsApp] ${eventName} omitido para ${orderNumber}: WhatsApp no conectado.`);
            await writeNotificationLog({
                channel: 'WHATSAPP',
                audience: 'CUSTOMER',
                event: eventName,
                status: 'SKIPPED',
                provider: getWhatsAppProvider(),
                recipient: phone,
                order,
                message: 'WhatsApp no conectado al momento de notificar.',
                error: lastError,
                details: {
                    connectionStatus,
                    hasSession: await hasSavedSession(),
                },
            });
            return;
        }

        const text = messageBuilder(order);
        await sendMessage(phone, text, 'Sistema');
        logger.info(`[WhatsApp] ${eventName} enviado para ${orderNumber} a ${phone}`);
        await writeNotificationLog({
            channel: 'WHATSAPP',
            audience: 'CUSTOMER',
            event: eventName,
            status: 'SENT',
            provider: getWhatsAppProvider(),
            recipient: phone,
            order,
            message: text,
            details: { connectionStatus },
        });
    } catch (error) {
        logger.error(`[WhatsApp] No se pudo enviar ${eventName} para ${orderNumber}: ${error.message}`);
        await writeNotificationLog({
            channel: 'WHATSAPP',
            audience: 'CUSTOMER',
            event: eventName,
            status: 'FAILED',
            provider: getWhatsAppProvider(),
            recipient: phone,
            order,
            error: error.message,
            details: {
                connectionStatus,
                stack: error.stack,
            },
        });
    }
};

export const sendCustomerOrderPaidNotification = async (order) => sendCustomerOrderMessage(
    order,
    (currentOrder) => {
        const itemsText = buildItemsSummary(currentOrder);
        return [
            'Hola, tu pago en Tecnotitlan fue confirmado.',
            `Pedido: ${getOrderNumber(currentOrder)}`,
            'Estado: Pago confirmado',
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
            await writeNotificationLog({
                channel: 'WHATSAPP',
                audience: 'ADMIN',
                event: 'aviso de pago admin',
                status: 'SENT',
                provider: getWhatsAppProvider(),
                recipient: adminWhatsappNumber,
                order,
                message,
                details: { connectionStatus },
            });
        } else if (adminWhatsappNumber) {
            logger.warn(`[WhatsApp] No se envio aviso de pago ${orderNumber}: cliente no inicializado.`);
            await writeNotificationLog({
                channel: 'WHATSAPP',
                audience: 'ADMIN',
                event: 'aviso de pago admin',
                status: 'SKIPPED',
                provider: getWhatsAppProvider(),
                recipient: adminWhatsappNumber,
                order,
                message: 'WhatsApp no conectado al momento de notificar al admin.',
                error: lastError,
                details: {
                    connectionStatus,
                    hasSession: await hasSavedSession(),
                },
            });
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
            await writeNotificationLog({
                channel: 'N8N',
                audience: 'ADMIN',
                event: 'order.paid',
                status: 'SENT',
                provider: 'n8n',
                order,
                message: 'Webhook de venta pagada enviado.',
            });
        }

        if (!adminWhatsappNumber && !n8nWebhookUrl) {
            logger.info(`[WhatsApp] Aviso de pago ${orderNumber} omitido: sin ADMIN_WHATSAPP_NUMBER ni N8N_ORDER_WEBHOOK_URL.`);
            await writeNotificationLog({
                channel: 'WHATSAPP',
                audience: 'ADMIN',
                event: 'aviso de pago admin',
                status: 'SKIPPED',
                provider: getWhatsAppProvider(),
                order,
                message: 'Sin ADMIN_WHATSAPP_NUMBER ni N8N_ORDER_WEBHOOK_URL configurados.',
            });
        }
    } catch (error) {
        logger.error(`[WhatsApp] No se pudo enviar aviso de pago: ${error.message}`);
        await writeNotificationLog({
            channel: 'WHATSAPP',
            audience: 'ADMIN',
            event: 'aviso de pago admin',
            status: 'FAILED',
            provider: getWhatsAppProvider(),
            order,
            error: error.message,
            details: {
                connectionStatus,
                stack: error.stack,
            },
        });
    }
};
