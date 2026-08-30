import crypto from 'crypto';

const PREFIX = 'enc:v1:';
const keySource = () => process.env.TOKEN_ENCRYPTION_KEY
  || process.env.SESSION_SECRET
  || process.env.JWT_SECRET;

const getKey = () => {
  const source = keySource();
  if (!source) throw new Error('Falta TOKEN_ENCRYPTION_KEY, SESSION_SECRET o JWT_SECRET para cifrar secretos.');
  return crypto.scryptSync(source, 'tecnotitlan-secret-storage-v1', 32);
};

export const isEncryptedSecret = (value) => typeof value === 'string' && value.startsWith(PREFIX);

export const encryptSecret = (value) => {
  if (value === null || value === undefined || value === '') return value;
  if (isEncryptedSecret(value)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
};

export const decryptSecret = (value) => {
  if (value === null || value === undefined || value === '') return value;
  if (!isEncryptedSecret(value)) return value;
  const [ivText, tagText, encryptedText] = value.slice(PREFIX.length).split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Secreto cifrado con formato invalido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const redactTokenPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const blocked = /(^|_)(access_?token|refresh_?token|token|secret|password|authorization)($|_)/i;
  return Object.fromEntries(Object.entries(payload).flatMap(([key, value]) => {
    if (blocked.test(key)) return [];
    if (Array.isArray(value)) return [[key, value]];
    if (value && typeof value === 'object') return [[key, redactTokenPayload(value)]];
    return [[key, value]];
  }));
};
