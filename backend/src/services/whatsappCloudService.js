import crypto from 'crypto';
import axios from 'axios';
import { getConfig } from './configService.js';
import { BadRequestError, UnauthorizedError } from '../utils/errorUtils.js';

const configValue = (key, fallback = '') => getConfig()[key] || process.env[key] || fallback;
const apiVersion = () => configValue('WHATSAPP_CLOUD_API_VERSION', 'v23.0');
const phoneNumberId = () => configValue('WHATSAPP_CLOUD_PHONE_NUMBER_ID');
const accessToken = () => configValue('WHATSAPP_CLOUD_ACCESS_TOKEN');
export const CLOUD_MEDIA_MAX_BYTES = 12 * 1024 * 1024;

const mediaKinds = new Map([
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['video/mp4', 'video'],
  ['video/3gpp', 'video'],
  ['audio/aac', 'audio'],
  ['audio/amr', 'audio'],
  ['audio/mpeg', 'audio'],
  ['audio/mp4', 'audio'],
  ['audio/ogg', 'audio'],
  ['application/pdf', 'document'],
  ['text/plain', 'document'],
  ['application/msword', 'document'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'document'],
  ['application/vnd.ms-excel', 'document'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'document'],
]);

const assertConfigured = () => {
  if (!phoneNumberId() || !accessToken()) {
    throw new BadRequestError('WhatsApp Cloud API requiere PHONE_NUMBER_ID y ACCESS_TOKEN.');
  }
};

const endpoint = (path) => `https://graph.facebook.com/${apiVersion()}/${path}`;
const authHeaders = () => ({ Authorization: `Bearer ${accessToken()}` });
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const cleanFileName = (value = 'archivo') => String(value || 'archivo')
  .replace(/[^a-zA-Z0-9._ -]/g, '-')
  .slice(0, 120) || 'archivo';

export const getCloudMediaKind = (mimeType) => mediaKinds.get(String(mimeType || '').toLowerCase()) || null;

const assertRecipient = (to) => {
  const recipient = normalizePhone(to);
  if (recipient.length < 10) throw new BadRequestError('Numero de WhatsApp invalido.');
  return recipient;
};

export const getCloudStatus = () => ({
  provider: 'cloud',
  status: phoneNumberId() && accessToken() ? 'READY' : 'ERROR',
  connected: Boolean(phoneNumberId() && accessToken()),
  configured: Boolean(phoneNumberId() && accessToken()),
  phoneNumberIdSuffix: phoneNumberId() ? phoneNumberId().slice(-4) : null,
  webhookReady: Boolean(configValue('WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN') && configValue('WHATSAPP_CLOUD_APP_SECRET')),
  mediaEnabled: true,
  hasSavedSession: false,
});

export const sendCloudText = async (to, message) => {
  assertConfigured();
  const recipient = assertRecipient(to);
  const { data } = await axios.post(endpoint(`${phoneNumberId()}/messages`), {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: { preview_url: false, body: String(message || '') },
  }, { headers: { ...authHeaders(), 'Content-Type': 'application/json' }, timeout: 15000 });
  return {
    accepted: Boolean(data?.messages?.[0]?.id),
    provider: 'cloud',
    recipientPhone: recipient,
    providerMessageId: data?.messages?.[0]?.id || null,
  };
};

export const uploadCloudMedia = async (file) => {
  assertConfigured();
  if (!file?.buffer?.length) throw new BadRequestError('Selecciona un archivo para enviar.');
  if (file.buffer.length > CLOUD_MEDIA_MAX_BYTES) throw new BadRequestError('El adjunto supera el limite seguro de 12 MB.');
  const mimeType = String(file.mimetype || '').toLowerCase();
  const type = getCloudMediaKind(mimeType);
  if (!type) throw new BadRequestError(`WhatsApp Cloud no admite el formato ${mimeType || 'desconocido'} en este panel.`);

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([file.buffer], { type: mimeType }), cleanFileName(file.originalname));
  const { data } = await axios.post(endpoint(`${phoneNumberId()}/media`), form, {
    headers: authHeaders(), timeout: 30000, maxBodyLength: CLOUD_MEDIA_MAX_BYTES,
  });
  if (!data?.id) throw new BadRequestError('Meta no devolvio el identificador del adjunto.');
  return { mediaId: data.id, type, mimeType, fileName: cleanFileName(file.originalname) };
};

export const sendCloudMedia = async (to, file, caption = '') => {
  const recipient = assertRecipient(to);
  const uploaded = await uploadCloudMedia(file);
  const cleanCaption = String(caption || '').trim().slice(0, 1024);
  const media = { id: uploaded.mediaId };
  if (cleanCaption && uploaded.type !== 'audio') media.caption = cleanCaption;
  if (uploaded.type === 'document') media.filename = uploaded.fileName;
  const { data } = await axios.post(endpoint(`${phoneNumberId()}/messages`), {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient,
    type: uploaded.type, [uploaded.type]: media,
  }, { headers: { ...authHeaders(), 'Content-Type': 'application/json' }, timeout: 30000 });
  return {
    accepted: Boolean(data?.messages?.[0]?.id), provider: 'cloud', recipientPhone: recipient,
    providerMessageId: data?.messages?.[0]?.id || null, ...uploaded,
  };
};

export const downloadCloudMedia = async (mediaId) => {
  assertConfigured();
  if (!mediaId) throw new BadRequestError('El webhook no incluyo el identificador del adjunto.');
  const { data: metadata } = await axios.get(endpoint(encodeURIComponent(mediaId)), {
    headers: authHeaders(), timeout: 15000,
  });
  if (!metadata?.url) throw new BadRequestError('Meta no devolvio la URL temporal del adjunto.');
  const { data } = await axios.get(metadata.url, {
    headers: authHeaders(), responseType: 'arraybuffer', timeout: 30000,
    maxContentLength: CLOUD_MEDIA_MAX_BYTES, maxBodyLength: CLOUD_MEDIA_MAX_BYTES,
  });
  return {
    buffer: Buffer.from(data),
    mimeType: metadata.mime_type || 'application/octet-stream',
    fileSize: Number(metadata.file_size || 0),
    sha256: metadata.sha256 || null,
  };
};

export const verifyCloudWebhook = ({ mode, token, challenge }) => {
  const expected = configValue('WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN');
  if (mode !== 'subscribe' || !expected || token !== expected) throw new UnauthorizedError('Webhook de WhatsApp no autorizado.');
  return challenge;
};

export const verifyCloudSignature = (rawBody, signature = '') => {
  const secret = configValue('WHATSAPP_CLOUD_APP_SECRET');
  if (!secret || !signature.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const supplied = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
};

export const normalizeCloudWebhook = (payload = {}) => {
  const changes = (payload.entry || []).flatMap((entry) => entry.changes || []);
  return changes.flatMap((change) => {
    const value = change.value || {};
    return (value.messages || []).map((message) => {
      const mediaPayload = ['image', 'video', 'audio', 'document', 'sticker'].includes(message.type)
        ? message[message.type]
        : null;
      return {
        messageId: message.id,
        from: message.from,
        timestamp: message.timestamp,
        type: message.type,
        text: message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '',
        raw: message,
        metadata: value.metadata || null,
        contacts: value.contacts || [],
        media: mediaPayload?.id ? {
          id: mediaPayload.id,
          type: message.type === 'sticker' ? 'image' : message.type,
          mimeType: mediaPayload.mime_type || null,
          fileName: mediaPayload.filename || null,
          caption: mediaPayload.caption || '',
        } : null,
      };
    });
  });
};
