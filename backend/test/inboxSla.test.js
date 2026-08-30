import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInboxSla } from '../src/utils/inboxSla.js';

const now = new Date('2026-08-30T18:00:00Z');

test('marca por vencer cuando queda menos del 25 por ciento del SLA', () => {
  const sla = evaluateInboxSla({ sourceType: 'WHATSAPP', priority: 'NORMAL', unreadCount: 1, canReply: true, messages: [{ direction: 'INBOUND', at: '2026-08-30T17:48:00Z' }] }, now);
  assert.equal(sla.state, 'AT_RISK');
  assert.equal(sla.remainingMinutes, 3);
});

test('marca vencido y conserva minutos de atraso', () => {
  const sla = evaluateInboxSla({ sourceType: 'MELI_QUESTION', priority: 'NORMAL', unreadCount: 1, canReply: true, messages: [{ direction: 'INBOUND', at: '2026-08-30T17:20:00Z' }] }, now);
  assert.equal(sla.state, 'BREACHED');
  assert.equal(sla.remainingMinutes, -10);
});

test('mide primera respuesta y no alerta conversaciones ya leidas', () => {
  const sla = evaluateInboxSla({ sourceType: 'SUPPORT', priority: 'NORMAL', unreadCount: 0, canReply: true, messages: [{ direction: 'INBOUND', at: '2026-08-30T15:00:00Z' }, { direction: 'OUTBOUND', at: '2026-08-30T15:45:00Z' }] }, now);
  assert.equal(sla.state, 'MET');
  assert.equal(sla.firstResponseMinutes, 45);
  assert.equal(sla.firstResponseMet, true);
});
