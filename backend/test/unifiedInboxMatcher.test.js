import test from 'node:test';
import assert from 'node:assert/strict';
import { findAutomaticInboxOrder, normalizeInboxPhone } from '../src/utils/unifiedInboxMatcher.js';

const orders = [
  {
    id: 'latest', userId: 'user-1',
    user: { email: 'cliente@ejemplo.com', phone: '+52 55 1234 5678' },
    shippingAddress: {},
  },
  {
    id: 'older', userId: 'user-2',
    user: { email: 'otro@ejemplo.com', phone: '55 8765 4321' },
    shippingAddress: {},
  },
];

test('sugiere el pedido mas reciente del usuario exacto', () => {
  const result = findAutomaticInboxOrder({ orders, userId: 'user-1' });
  assert.equal(result.order.id, 'latest');
  assert.equal(result.method, 'AUTO_USER');
  assert.equal(result.confidence, 100);
});

test('normaliza lada internacional y exige el telefono nacional completo', () => {
  assert.equal(normalizeInboxPhone('+52 (55) 1234-5678'), '5512345678');
  const result = findAutomaticInboxOrder({ orders, phone: '+52 55 1234 5678' });
  assert.equal(result.order.id, 'latest');
  assert.equal(result.method, 'AUTO_PHONE');
});

test('no enlaza por fragmentos de telefono', () => {
  const result = findAutomaticInboxOrder({ orders, phone: '12345678' });
  assert.equal(result, null);
});

test('el correo se compara completo sin distinguir mayusculas', () => {
  const result = findAutomaticInboxOrder({ orders, email: ' CLIENTE@EJEMPLO.COM ' });
  assert.equal(result.order.id, 'latest');
  assert.equal(result.method, 'AUTO_EMAIL');
});
