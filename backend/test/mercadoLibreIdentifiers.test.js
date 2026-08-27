import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMercadoLibreId,
  isMercadoLibreItemId,
  isSameMercadoLibreIdentifier,
  buildMercadoLibreFamilyName,
  normalizeGtin,
  isRequiredMercadoLibreAttribute,
  isConditionalMercadoLibreAttribute,
} from '../src/utils/mercadoLibreIdentifiers.js';

test('normaliza identificadores de Mercado Libre', () => {
  assert.equal(normalizeMercadoLibreId(' mlm1234567890 '), 'MLM1234567890');
  assert.equal(normalizeMercadoLibreId(null), null);
  assert.equal(normalizeMercadoLibreId('undefined'), null);
});

test('distingue una publicacion de una categoria', () => {
  assert.equal(isMercadoLibreItemId('MLM1234567890'), true);
  assert.equal(isMercadoLibreItemId('MLM126793'), false);
});

test('detecta cuando se guardo la categoria como publicacion', () => {
  assert.equal(isSameMercadoLibreIdentifier('mlm126793', 'MLM126793'), true);
  assert.equal(isSameMercadoLibreIdentifier('MLM1234567890', 'MLM126793'), false);
});

test('construye la familia de Mercado Libre con marca y modelo', () => {
  assert.equal(
    buildMercadoLibreFamilyName({ brand: 'G-Tide', model: 'R9 Pro' }),
    'G-Tide R9 Pro',
  );
});

test('no duplica la marca cuando el modelo ya la incluye', () => {
  assert.equal(
    buildMercadoLibreFamilyName({ brand: 'G-Tide', model: 'G-Tide R9 Pro' }),
    'G-Tide R9 Pro',
  );
});

test('respeta una familia explicita y tiene fallback al producto', () => {
  assert.equal(
    buildMercadoLibreFamilyName({
      requestedFamilyName: 'Smartwatch G-Tide R9',
      brand: 'G-Tide',
      model: 'R9 Pro',
    }),
    'Smartwatch G-Tide R9',
  );
  assert.equal(
    buildMercadoLibreFamilyName({ productName: 'Reloj inteligente R9' }),
    'Reloj inteligente R9',
  );
});

test('normaliza formatos comunes de GTIN, EAN y UPC', () => {
  assert.equal(normalizeGtin('7501 2345 6789 3'), '7501234567893');
  assert.equal(normalizeGtin('012345678905'), '012345678905');
  assert.equal(normalizeGtin(''), null);
  assert.equal(normalizeGtin(undefined), undefined);
});

test('rechaza codigos universales con longitud invalida', () => {
  assert.throws(
    () => normalizeGtin('12345'),
    (error) => error.statusCode === 400 && /8, 12, 13 o 14/.test(error.message),
  );
});

test('distingue atributos obligatorios y condicionales de Mercado Libre', () => {
  assert.equal(isRequiredMercadoLibreAttribute({ tags: { required: true } }), true);
  assert.equal(isRequiredMercadoLibreAttribute({ tags: { catalog_required: true } }), true);
  assert.equal(isRequiredMercadoLibreAttribute({ tags: { conditional_required: true } }), false);
  assert.equal(isRequiredMercadoLibreAttribute({ tags: { recommended: true } }), false);
  assert.equal(isConditionalMercadoLibreAttribute({ tags: { conditional_required: true } }), true);
  assert.equal(isConditionalMercadoLibreAttribute({ tags: { required: true } }), false);
});
