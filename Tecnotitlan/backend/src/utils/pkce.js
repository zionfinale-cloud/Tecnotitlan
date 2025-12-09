import crypto from 'crypto';

/**
 * Encodes a Buffer into a Base64-URL-encoded string.
 * This format is required for PKCE code challenges.
 * @param {Buffer} buffer The buffer to encode.
 * @returns {string} The Base64-URL-encoded string.
 */
export const base64UrlEncode = (buffer) => {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Generates a cryptographically secure random string to be used as a PKCE code verifier.
 * @param {number} length The length of the string to generate.
 * @returns {string} The random string (code_verifier).
 */
export const generateRandomString = (length) => {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
};

/**
 * Creates a Base64-URL-encoded SHA-256 hash of a string (the code_challenge).
 * @param {string} verifier The code verifier string.
 * @returns {string} The code challenge.
 */
export const generateCodeChallenge = (verifier) => {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
};
