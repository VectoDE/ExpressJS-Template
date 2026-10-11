const crypto = require('node:crypto');

/**
 * Time-based one-time passwords (RFC 6238 on top of RFC 4226): HMAC-SHA1, 30-second steps, 6 digits.
 * These are the parameters every common authenticator app supports.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const base32Decode = (input) => {
  const clean = String(input)
    .toUpperCase()
    .replaceAll(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

// 160 bits, the size RFC 4226 recommends for HMAC-SHA1.
const generateSecret = () => base32Encode(crypto.randomBytes(20));

const hotp = (secret, counter) => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = digest.at(-1) & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

const generate = (secret, now = Date.now()) => hotp(secret, currentStep(now));

/**
 * Accepts the current step and one step on either side for clock drift. Returns the matched step, or null.
 * Steps at or below `afterStep` are refused, so an observed code cannot be replayed.
 */
const verify = (secret, code, { afterStep = -1, now = Date.now() } = {}) => {
  if (!/^\d{6}$/.test(String(code))) {
    return null;
  }
  const step = currentStep(now);
  for (const candidate of [step - 1, step, step + 1]) {
    const expected = Buffer.from(hotp(secret, candidate));
    if (candidate > afterStep && crypto.timingSafeEqual(expected, Buffer.from(String(code)))) {
      return candidate;
    }
  }
  return null;
};

const otpauthUrl = ({ secret, account, issuer }) => {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};

module.exports = { base32Encode, base32Decode, generateSecret, generate, verify, otpauthUrl, hotp };
