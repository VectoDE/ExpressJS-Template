const crypto = require('crypto');

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

const hashPassword = (password) =>
  new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });

const comparePassword = (password, hashedPassword) =>
  new Promise((resolve, reject) => {
    const [salt, key] = (hashedPassword || '').split(':');
    if (!salt || !key) {
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      const hashedBuffer = Buffer.from(key, 'hex');
      const match = crypto.timingSafeEqual(hashedBuffer, derivedKey);
      resolve(match);
    });
  });

module.exports = {
  hashPassword,
  comparePassword,
};
