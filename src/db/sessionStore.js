const crypto = require('node:crypto');
const session = require('express-session');

/**
 * express-session store on the configured database, so browser sessions work with MongoDB and every SQL database
 * and survive restarts. Session data is encrypted with AES-256-GCM under a key derived from SESSION_SECRET; a
 * database dump alone does not reveal who is signed in or what a session contains.
 */
const VERSION = 'v1';

class DatabaseSessionStore extends session.Store {
  constructor({ db, secret, idleTimeoutMs }) {
    super();
    this.db = db;
    this.idleTimeoutMs = idleTimeoutMs;
    this.key = Buffer.from(crypto.hkdfSync('sha256', secret, 'expressjs-template', 'session-store', 32));
  }

  encrypt(data) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    return [VERSION, ...[iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url'))].join('.');
  }

  decrypt(payload) {
    const [version, iv, tag, ciphertext] = String(payload).split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext) {
      return null;
    }
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]);
      return JSON.parse(plaintext.toString('utf8'));
    } catch {
      // Tampered data or a changed SESSION_SECRET: the session is treated as missing, never as an error page.
      return null;
    }
  }

  expiresAt(data) {
    const expires = data?.cookie?.expires;
    return expires ? new Date(expires) : new Date(Date.now() + this.idleTimeoutMs);
  }

  get(sid, callback) {
    this.db.sessions
      .get(sid, new Date())
      .then((payload) => callback(null, payload ? this.decrypt(payload) : null))
      .catch((error) => callback(error));
  }

  set(sid, data, callback) {
    this.db.sessions
      .set(sid, this.encrypt(data), this.expiresAt(data))
      .then(() => callback?.(null))
      .catch((error) => callback?.(error));
  }

  touch(sid, data, callback) {
    this.db.sessions
      .touch(sid, this.expiresAt(data))
      .then(() => callback?.(null))
      .catch((error) => callback?.(error));
  }

  destroy(sid, callback) {
    this.db.sessions
      .destroy(sid)
      .then(() => callback?.(null))
      .catch((error) => callback?.(error));
  }
}

module.exports = DatabaseSessionStore;
