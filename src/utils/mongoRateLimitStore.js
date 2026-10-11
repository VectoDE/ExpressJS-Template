const mongoose = require('mongoose');

/**
 * express-rate-limit store backed by MongoDB, so several app instances share one counter per client.
 * One document per key holds the hit count and the end of the current window; a TTL index removes
 * expired windows. The update is a single atomic pipeline, so parallel requests cannot undercount.
 */
const COLLECTION = 'rate_limits';
let indexReady;

class MongoRateLimitStore {
  constructor({ prefix }) {
    this.prefix = prefix;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  get collection() {
    return mongoose.connection.collection(COLLECTION);
  }

  async ensureIndex() {
    indexReady ??= this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
      indexReady = undefined;
      throw error;
    });
    return indexReady;
  }

  async increment(key, attempt = 0) {
    await this.ensureIndex();
    const now = new Date();
    const expired = { $or: [{ $eq: [{ $type: '$expiresAt' }, 'missing'] }, { $lte: ['$expiresAt', now] }] };
    try {
      const doc = await this.collection.findOneAndUpdate(
        { _id: `${this.prefix}${key}` },
        [
          {
            $set: {
              hits: { $cond: [expired, 1, { $add: ['$hits', 1] }] },
              expiresAt: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$expiresAt'] },
            },
          },
        ],
        { upsert: true, returnDocument: 'after' }
      );
      return { totalHits: doc.hits, resetTime: doc.expiresAt };
    } catch (error) {
      // Two first requests can race on the upsert; the second one simply retries.
      if (error.code === 11000 && attempt < 2) {
        return this.increment(key, attempt + 1);
      }
      throw error;
    }
  }

  async decrement(key) {
    await this.collection.updateOne({ _id: `${this.prefix}${key}`, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await this.collection.deleteOne({ _id: `${this.prefix}${key}` });
  }
}

module.exports = MongoRateLimitStore;
