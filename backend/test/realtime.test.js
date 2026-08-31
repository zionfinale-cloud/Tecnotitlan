import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { notifyRealtimeMutations, topicsForPath } from '../src/middleware/realtimeMiddleware.js';
import { configureRealtime, emitRealtimeMany } from '../src/services/realtimeService.js';

const emitted = [];
const io = {
  use: () => {},
  on: () => {},
  to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
};

configureRealtime(io);

test('mapea mutaciones de Mercado Libre a las vistas dependientes', () => {
  assert.deepEqual(topicsForPath('/api/mercadolibre/orders'), [
    'meli', 'marketplaces', 'orders', 'inventory', 'inbox', 'dashboard',
  ]);
});

test('elimina temas repetidos antes de emitir invalidaciones', () => {
  emitted.length = 0;
  emitRealtimeMany(['products', 'products', 'inventory'], 'test.updated');
  assert.deepEqual(emitted.map(({ payload }) => payload.topic), ['products', 'inventory']);
  assert.ok(emitted.every(({ room, event }) => room === 'admins' && event === 'data:changed'));
});

test('espera una mutacion exitosa y no anticipa el webhook de Mercado Libre', () => {
  emitted.length = 0;
  const response = new EventEmitter();
  response.statusCode = 200;
  notifyRealtimeMutations(
    { method: 'PATCH', originalUrl: '/api/products/AUR-001', params: { sku: 'AUR-001' } },
    response,
    () => {},
  );
  assert.equal(emitted.length, 0);
  response.emit('finish');
  assert.ok(emitted.some(({ room, payload }) => room === 'public' && payload.topic === 'products'));

  emitted.length = 0;
  notifyRealtimeMutations(
    { method: 'POST', originalUrl: '/api/mercadolibre/notifications', params: {} },
    new EventEmitter(),
    () => {},
  );
  assert.equal(emitted.length, 0);
});
