const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

// OWASP Password Storage Cheat Sheet: scrypt with N=2^17, r=8, p=1.
const PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const LEGACY_PARAMS = { N: 2 ** 14, r: 8, p: 1 };
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 128;
const PREFIX = 'scrypt';

const derive = (password, salt, { N, r, p }) =>
  scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r });

const hashPassword = async (password) => {
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    throw new TypeError('Password must be a string of at most 128 characters');
  }
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, PARAMS);
  return [PREFIX, PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
};

/**
 * Accepts the current format `scrypt$N$r$p$salt$key` and the 1.x format `saltHex:keyHex`.
 * Malformed input never throws, it simply does not match.
 */
const parseHash = (stored) => {
  if (typeof stored !== 'string') {
    return null;
  }
  const parts = stored.split('$');
  if (parts.length === 6 && parts[0] === PREFIX) {
    const [N, r, p] = parts.slice(1, 4).map(Number);
    if (![N, r, p].every((value) => Number.isSafeInteger(value)) || N > 2 ** 20 || r > 32 || p > 4) {
      return null;
    }
    return { params: { N, r, p }, salt: Buffer.from(parts[4], 'base64'), key: Buffer.from(parts[5], 'base64') };
  }
  const legacy = /^([0-9a-f]{32}):([0-9a-f]{128})$/.exec(stored);
  if (legacy) {
    // 1.x used the hex string itself as salt, not the decoded bytes.
    return { params: LEGACY_PARAMS, salt: legacy[1], key: Buffer.from(legacy[2], 'hex') };
  }
  return null;
};

const comparePassword = async (password, stored) => {
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  const parsed = parseHash(stored);
  if (parsed?.key.length !== KEY_LENGTH) {
    return false;
  }
  const derived = await derive(password, parsed.salt, parsed.params);
  return crypto.timingSafeEqual(parsed.key, derived);
};

const needsRehash = (stored) => {
  const parsed = parseHash(stored);
  return !parsed || typeof parsed.salt === 'string' || parsed.params.N < PARAMS.N || parsed.params.r < PARAMS.r;
};

// Spends the same work as a real check, so unknown accounts cannot be told apart by response time.
let dummyHash;
const burnPasswordCheck = async (password) => {
  dummyHash = dummyHash || hashPassword(crypto.randomBytes(24).toString('base64'));
  await comparePassword(typeof password === 'string' ? password : '', await dummyHash);
  return false;
};

module.exports = {
  MAX_PASSWORD_LENGTH,
  hashPassword,
  comparePassword,
  needsRehash,
  burnPasswordCheck,
};
