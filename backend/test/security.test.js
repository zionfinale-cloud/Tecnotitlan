import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret, isEncryptedSecret, redactTokenPayload } from '../src/utils/secretCrypto.js';
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotp } from '../src/utils/totp.js';

process.env.JWT_SECRET ||= 'test-security-secret-with-enough-entropy';

test('cifra secretos con nonce unico y los recupera', () => {
  const first = encryptSecret('meli-access-token');
  const second = encryptSecret('meli-access-token');
  assert.equal(isEncryptedSecret(first), true);
  assert.notEqual(first, second);
  assert.equal(decryptSecret(first), 'meli-access-token');
});

test('mantiene lectura compatible para valores antiguos sin cifrar', () => {
  assert.equal(decryptSecret('legacy-token'), 'legacy-token');
  assert.equal(encryptSecret(null), null);
});

test('elimina tokens y secretos de payloads anidados', () => {
  assert.deepEqual(redactTokenPayload({ access_token: 'x', profile: { id: 1, secret: 'y' } }), { profile: { id: 1 } });
});

test('valida TOTP en la ventana actual y rechaza codigos incorrectos', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(verifyTotp(secret, '287082', { window: 0, now: 59000 }), true);
  assert.equal(verifyTotp(secret, '000000', { window: 0, now: 59000 }), false);
  assert.ok(generateTotpSecret().length >= 32);
});

test('genera codigos de recuperacion unicos y hashes estables', () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(codes[0].toLowerCase()));
  assert.notEqual(hashRecoveryCode(codes[0]), codes[0]);
});
