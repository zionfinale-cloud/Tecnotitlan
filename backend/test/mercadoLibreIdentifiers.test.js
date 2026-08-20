import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMercadoLibreId,
  isMercadoLibreItemId,
  isSameMercadoLibreIdentifier,
} from '../src/utils/mercadoLibreIdentifiers.js';

test('normaliza identificadores de Mercado Libre', () => {
  assert.equal(normalizeMercadoLibreId(' mlm1234567890 '), 'MLM1234567890');
});

test('distingue una publicacion de una categoria', () => {
  assert.equal(isMercadoLibreItemId('MLM1234567890'), true);
  assert.equal(isMercadoLibreItemId('MLM126793'), false);
});

test('detecta cuando se guardo la categoria como publicacion', () => {
  assert.equal(isSameMercadoLibreIdentifier('mlm126793', 'MLM126793'), true);
  assert.equal(isSameMercadoLibreIdentifier('MLM1234567890', 'MLM126793'), false);
});
