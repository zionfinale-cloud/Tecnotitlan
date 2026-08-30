import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySource, deviceFamily } from '../src/controllers/analyticsController.js';

test('clasifica origen directo, buscador, social, referido y campaña', () => {
  assert.equal(classifySource(null, null), 'DIRECT');
  assert.equal(classifySource('www.google.com', null), 'SEARCH');
  assert.equal(classifySource('instagram.com', null), 'SOCIAL');
  assert.equal(classifySource('blog.example.com', null), 'REFERRAL');
  assert.equal(classifySource('google.com', 'summer'), 'CAMPAIGN');
});

test('separa móviles, escritorio y bots', () => {
  assert.equal(deviceFamily('Mozilla iPhone Mobile'), 'MOBILE');
  assert.equal(deviceFamily('Mozilla Windows Chrome'), 'DESKTOP');
  assert.equal(deviceFamily('Googlebot crawler'), 'BOT');
});
