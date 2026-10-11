const crypto = require('node:crypto');
const config = require('../config/config');

/**
 * Encryption at rest for small secrets (two-factor keys). AES-256-GCM with a key derived from
 * ENCRYPTION_KEY, so the raw configuration value is never used as a key directly.
 * Format: v1.<iv>.<tag>.<ciphertext>, all base64url.
 */
const VERSION = 'v1';
const key = Buffer.from(crypto.hkdfSync('sha256', config.encryptionKey, 'expressjs-template', 'data-encryption', 32));

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (Buffer.isBuffer(part) ? part.toString('base64url') : part))
    .join('.');
};

const decrypt = (payload) => {
  const [version, iv, tag, ciphertext] = String(payload).split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unsupported encrypted payload');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
};

// Opaque single-use tokens for links in emails. Only their SHA-256 is stored.
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// Compares two strings without leaking through timing where they differ.
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

module.exports = { encrypt, decrypt, randomToken, sha256, safeEqual };
