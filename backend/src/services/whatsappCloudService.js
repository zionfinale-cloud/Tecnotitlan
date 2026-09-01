import crypto from 'crypto';
import axios from 'axios';
import { getConfig } from './configService.js';
import { BadRequestError, UnauthorizedError } from '../utils/errorUtils.js';

const configValue = (key, fallback = '') => getConfig()[key] || process.env[key] || fallback;
const apiVersion = () => configValue('WHATSAPP_CLOUD_API_VERSION', 'v23.0');
const phoneNumberId = () => configValue('WHATSAPP_CLOUD_PHONE_NUMBER_ID');
const accessToken = () => configValue('WHATSAPP_CLOUD_ACCESS_TOKEN');

const assertConfigured = () => {
  if (!phoneNumberId() || !accessToken()) {
    throw new BadRequestError('WhatsApp Cloud API requiere PHONE_NUMBER_ID y ACCESS_TOKEN.');
  }
};

const endpoint = (path) => `https://graph.facebook.com/${apiVersion()}/${path}`;
const authHeaders = () => ({ Authorization: `Bearer ${accessToken()}` });
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

export const getCloudStatus = () => ({
  provider: 'cloud',
  status: phoneNumberId() && accessToken() ? 'READY' : 'ERROR',
  connected: Boolean(phoneNumberId() && accessToken()),
  configured: Boolean(phoneNumberId() && accessToken()),
  phoneNumberIdSuffix: phoneNumberId() ? phoneNumberId().slice(-4) : null,
  hasSavedSession: false,
});

export const sendCloudText = async (to, message) => {
  assertConfigured();
  const recipient = normalizePhone(to);
  if (recipient.length < 10) throw new BadRequestError('Numero de WhatsApp invalido.');
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
    return (value.messages || []).map((message) => ({
      messageId: message.id,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '',
      raw: message,
      metadata: value.metadata || null,
      contacts: value.contacts || [],
    }));
  });
};
