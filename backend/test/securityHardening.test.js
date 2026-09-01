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
import { normalizeCloudWebhook } from '../src/services/whatsappCloudService.js';

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
