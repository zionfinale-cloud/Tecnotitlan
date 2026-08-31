import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInboxItem, INBOX_SECTIONS, shouldNotifyCancellation, shouldNotifyNewClaim } from '../src/utils/unifiedInboxClassification.js';

test('separa reclamos como casos importantes', () => {
  assert.deepEqual(classifyInboxItem({ sourceType: 'MELI_CLAIM' }), {
    section: INBOX_SECTIONS.IMPORTANT, type: 'CLAIM', typeLabel: 'Reclamo', important: true,
  });
});

test('distingue cancelaciones ligadas a un reclamo', () => {
  assert.equal(classifyInboxItem({ sourceType: 'MELI_CLAIM', linkedOrder: { status: 'CANCELLED' } }).type, 'CANCELLATION');
});

test('distingue devoluciones antes que cancelaciones', () => {
  assert.equal(classifyInboxItem({ sourceType: 'MELI_CLAIM', returnId: 'return-1', linkedOrder: { status: 'CANCELLED' } }).type, 'RETURN');
});

test('separa preguntas y mensajes privados', () => {
  assert.equal(classifyInboxItem({ sourceType: 'MELI_QUESTION' }).type, 'QUESTION');
  const message = classifyInboxItem({ sourceType: 'MELI_POST_SALE' });
  assert.equal(message.section, INBOX_SECTIONS.CONVERSATIONS);
  assert.equal(message.type, 'PRIVATE_MESSAGE');
});

test('avisa sólo cuando un reclamo entra como abierto', () => {
  assert.equal(shouldNotifyNewClaim(null, { status: 'opened' }), true);
  assert.equal(shouldNotifyNewClaim({ status: 'opened' }, { status: 'opened' }), false);
  assert.equal(shouldNotifyNewClaim(null, { status: 'closed' }), false);
});

test('avisa cancelación sólo durante la transición', () => {
  assert.equal(shouldNotifyCancellation('PROCESSING', 'CANCELLED'), true);
  assert.equal(shouldNotifyCancellation('CANCELLED', 'CANCELLED'), false);
});
