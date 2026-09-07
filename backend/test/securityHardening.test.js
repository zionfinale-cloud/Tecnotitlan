import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { sanitizeLegalHtml } from '../src/utils/sanitizeHtml.js';
import {
  AUTH_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAME,
  readAuthCookieHeader,
  setAuthCookie,
} from '../src/utils/authCookies.js';
import { generateAuthToken } from '../src/utils/authTokens.js';
import { CLOUD_MEDIA_MAX_BYTES, getCloudMediaKind, normalizeCloudWebhook } from '../src/services/whatsappCloudService.js';
import { canUseRouteBeforeTwoFactorEnrollment, getMyWorkAccess, requiresTwoFactorEnrollment } from '../src/utils/accessPolicies.js';

process.env.JWT_SECRET ||= 'test-security-secret-with-enough-entropy';

test('sanitiza HTML legal y conserva contenido editorial seguro', () => {
  const clean = sanitizeLegalHtml('<h2>Terminos</h2><script>alert(1)</script><a href="javascript:alert(2)" target="_blank">enlace</a>');
  assert.match(clean, /<h2>Terminos<\/h2>/);
  assert.doesNotMatch(clean, /script|javascript/i);
  assert.match(clean, /rel="noopener noreferrer"/);
});

test('la sesion usa cookie HttpOnly de ocho horas', () => {
  let captured;
  const response = { cookie: (name, value, options) => { captured = { name, value, options }; } };
  setAuthCookie(response, 'signed-token');
  assert.equal(captured.name, AUTH_COOKIE_NAME);
  assert.equal(captured.value, 'signed-token');
  assert.equal(captured.options.httpOnly, true);
  assert.equal(captured.options.sameSite, 'lax');
  assert.equal(captured.options.maxAge, AUTH_COOKIE_MAX_AGE_MS);
  assert.equal(readAuthCookieHeader(`foo=bar; ${AUTH_COOKIE_NAME}=signed-token`), 'signed-token');
});

test('el JWT de autenticacion expira en ocho horas', () => {
  const decoded = jwt.decode(generateAuthToken({ id: 'user-1', tokenVersion: 3 }));
  assert.equal(decoded.ver, 3);
  assert.equal(decoded.exp - decoded.iat, 8 * 60 * 60);
});

test('normaliza mensajes entrantes de WhatsApp Cloud', () => {
  const messages = normalizeCloudWebhook({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '123' },
      contacts: [{ wa_id: '5215555555555' }],
      messages: [{ id: 'wamid.1', from: '5215555555555', timestamp: '1', type: 'text', text: { body: 'Hola' } }],
    } }] }],
  });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, 'wamid.1');
  assert.equal(messages[0].text, 'Hola');
});

test('clasifica adjuntos permitidos y extrae el media id del webhook Cloud', () => {
  assert.equal(getCloudMediaKind('image/jpeg'), 'image');
  assert.equal(getCloudMediaKind('video/mp4'), 'video');
  assert.equal(getCloudMediaKind('application/pdf'), 'document');
  assert.equal(getCloudMediaKind('application/x-msdownload'), null);
  assert.equal(CLOUD_MEDIA_MAX_BYTES, 12 * 1024 * 1024);

  const [message] = normalizeCloudWebhook({
    entry: [{ changes: [{ value: { messages: [{
      id: 'wamid.media', from: '5215555555555', timestamp: '2', type: 'document',
      document: { id: 'media-123', mime_type: 'application/pdf', filename: 'guia.pdf', caption: 'Guía' },
    }] } }] }],
  });
  assert.deepEqual(message.media, {
    id: 'media-123', type: 'document', mimeType: 'application/pdf', fileName: 'guia.pdf', caption: 'Guía',
  });
});

test('obliga 2FA al personal y sólo permite completar su enrolamiento', () => {
  const seller = { role: { name: 'VENDEDOR' }, twoFactorEnabled: false };
  assert.equal(requiresTwoFactorEnrollment(seller, '/api/orders'), true);
  assert.equal(canUseRouteBeforeTwoFactorEnrollment('/api/security/2fa/setup'), true);
  assert.equal(requiresTwoFactorEnrollment(seller, '/api/security/activity'), true);
  assert.equal(requiresTwoFactorEnrollment({ ...seller, twoFactorEnabled: true }, '/api/orders'), false);
  assert.equal(requiresTwoFactorEnrollment({ role: { name: 'USER' }, twoFactorEnabled: false }, '/api/orders'), false);
  assert.equal(requiresTwoFactorEnrollment({ role: { name: 'ALMACEN' }, twoFactorEnabled: false }, '/api/orders'), true);
});

test('calcula Mi trabajo de acuerdo con permisos y responsabilidad del rol', () => {
  assert.deepEqual(getMyWorkAccess({ role: 'USER', permissions: [] }), {
    canOrders: false, canSupport: false, canManageTeam: false,
  });
  assert.deepEqual(getMyWorkAccess({ role: { name: 'VENDEDOR' }, permissions: ['order:read', 'support:update'] }), {
    canOrders: true, canSupport: true, canManageTeam: false,
  });
  assert.equal(getMyWorkAccess({ role: { name: 'ADMIN' }, permissions: ['support:read'] }).canManageTeam, true);
});
