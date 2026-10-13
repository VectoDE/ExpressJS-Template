// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * express-rate-limit store on the configured database, so several app instances share one counter per client.
 * The adapters count atomically, so parallel requests cannot undercount.
 */
class DatabaseRateLimitStore {
  constructor({ db, prefix }) {
    this.db = db;
    this.prefix = prefix;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const { hits, expiresAt } = await this.db.rateLimits.increment(`${this.prefix}${key}`, this.windowMs, new Date());
    return { totalHits: hits, resetTime: expiresAt };
  }

  async decrement(key) {
    await this.db.rateLimits.decrement(`${this.prefix}${key}`);
  }

  async resetKey(key) {
    await this.db.rateLimits.reset(`${this.prefix}${key}`);
  }
}

module.exports = DatabaseRateLimitStore;
