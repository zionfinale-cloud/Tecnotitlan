import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPackIdFromMessage,
  getMessageText,
} from '../src/services/mercadoLibreService.js';

test('obtiene el pack relacionado desde un mensaje posventa moderno', () => {
  assert.equal(getPackIdFromMessage({
    message_resources: [
      { id: '2000012345678901', name: 'packs' },
      { id: '3569356856', name: 'sellers' },
    ],
  }), '2000012345678901');
});

test('usa la orden cuando Mercado Libre no creo un pack', () => {
  assert.equal(getPackIdFromMessage({ resource: 'orders', resource_id: '1234567890' }), '1234567890');
});

test('normaliza el texto de formatos nuevos y anteriores de mensajes', () => {
  assert.equal(getMessageText({ text: '  Mensaje nuevo  ' }), 'Mensaje nuevo');
  assert.equal(getMessageText({ text: { plain: '  Mensaje anterior  ' } }), 'Mensaje anterior');
});
