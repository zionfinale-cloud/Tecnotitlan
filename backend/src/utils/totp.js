import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const encodeBase32 = (buffer) => {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
};

const decodeBase32 = (value) => {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of clean) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Secreto TOTP invalido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};

export const generateTotpSecret = () => encodeBase32(crypto.randomBytes(20));

const totpAt = (secret, counter) => {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, '0');
};

export const verifyTotp = (secret, code, { window = 1, now = Date.now() } = {}) => {
  const normalized = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 30000);
  return Array.from({ length: window * 2 + 1 }, (_, index) => index - window)
    .some((offset) => {
      const expected = totpAt(secret, counter + offset);
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized));
    });
};

export const buildOtpAuthUri = ({ secret, email, issuer = 'Tecnotitlan' }) => {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
};

export const generateRecoveryCodes = (count = 10) => Array.from({ length: count }, () => {
  const value = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${value.slice(0, 5)}-${value.slice(5)}`;
});

export const hashRecoveryCode = (code) => crypto
  .createHmac('sha256', keySourceForRecovery())
  .update(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
  .digest('hex');

const keySourceForRecovery = () => process.env.TOKEN_ENCRYPTION_KEY
  || process.env.SESSION_SECRET
  || process.env.JWT_SECRET
  || 'tecnotitlan-recovery-development';
