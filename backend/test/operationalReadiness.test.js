import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReadiness } from '../src/services/operationalReadinessService.js';

test('declara listo el sistema cuando todos los controles operativos están completos', () => {
  const result = calculateReadiness({
    staffTotal: 2, staffWithTwoFactor: 2, meliConnections: 1,
    config: { SMTP_HOST: 'smtp', SMTP_USER: 'user', SMTP_PASS: 'pass', STRIPE_SECRET_KEY: 'sk', STRIPE_WEBHOOK_SECRET: 'whsec', WHATSAPP_PROVIDER: 'cloud' },
    whatsapp: { provider: 'cloud', connected: true, webhookReady: true },
    monitoringEnabled: true,
  });
  assert.equal(result.score, 100);
  assert.equal(result.readyCount, result.total);
});

test('señala 2FA y WhatsApp sin revelar credenciales', () => {
  const result = calculateReadiness({
    staffTotal: 3, staffWithTwoFactor: 1, meliConnections: 1,
    config: { SMTP_HOST: 'smtp', SMTP_USER: 'user', SMTP_PASS: 'pass', PAYPAL_CLIENT_ID: 'public', WHATSAPP_PROVIDER: 'baileys' },
    whatsapp: { provider: 'baileys', connected: false, adminGroupConfigured: false },
  });
  assert.equal(result.checks.find((check) => check.id === 'staff-2fa').ready, false);
  assert.equal(result.checks.find((check) => check.id === 'whatsapp').ready, false);
  assert.equal(JSON.stringify(result).includes('pass'), false);
});
