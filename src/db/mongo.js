const os = require('node:os');
const { MongoClient, ObjectId } = require('mongodb');
const { isId } = require('../utils/id');
const { userRecord, tokenRecord, auditRecord, emptyTwoFactor } = require('./records');

/**
 * MongoDB adapter on the official driver. Field names and ObjectId keys match the collections of version 3.0.0,
 * so existing data keeps working. Filters are built here from typed values only; input never becomes an operator.
 */

// An id that is not 24 hex characters becomes null, which matches no stored record instead of throwing.
const oid = (id) => (isId(String(id)) ? new ObjectId(String(id)) : null);
const hex = (value) => (value instanceof ObjectId ? value.toHexString() : String(value));

const fromUserDoc = (doc) => doc && userRecord({ ...doc, id: hex(doc._id) });
const fromTokenDoc = (doc) => doc && tokenRecord({ ...doc, id: hex(doc._id), userId: hex(doc.user) });

const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const USER_FIELDS = new Set([
  'name',
  'email',
  'password',
  'role',
  'isEmailVerified',
  'locale',
  'credentialsChangedAt',
  'failedLoginAttempts',
  'lockUntil',
  'twoFactor',
]);

const createMongoAdapter = ({ url, dbName, auditRetentionDays }) => {
  // Jest's sandbox cannot run the driver's dynamic import('os'); hand the module over directly.
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 10000, runtimeAdapters: { os } });
  let db;
  const col = (name) => db.collection(name);

  const ensureIndexes = () =>
    Promise.all([
      col('users').createIndex({ email: 1 }, { unique: true }),
      col('tokens').createIndex({ tokenHash: 1 }, { unique: true }),
      col('tokens').createIndex({ user: 1, type: 1 }),
      col('tokens').createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
      col('auditevents').createIndex({ user: 1, createdAt: -1 }),
      col('auditevents').createIndex({ createdAt: 1 }, { expireAfterSeconds: auditRetentionDays * 24 * 60 * 60 }),
      col('web_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      col('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);

  const ownedCollections = new Set();

  // Records that belong to one account, for resources made with `npm run generate`. Every call filters on the
  // owner, so one account can never read or change another account's records.
  const owned = (name) => {
    ownedCollections.add(name);
    let indexReady;
    const collection = () => {
      indexReady ??= col(name).createIndex({ owner: 1, createdAt: -1 });
      return indexReady.then(() => col(name));
    };
    const fromDoc = (doc) => {
      if (!doc) return null;
      const { _id: id, ...rest } = doc;
      delete rest.owner;
      return { id: hex(id), ...rest };
    };
    return {
      async create(ownerId, { id, ...data }) {
        const now = new Date();
        const doc = { ...data, _id: oid(id), owner: oid(ownerId), createdAt: now, updatedAt: now };
        await (await collection()).insertOne(doc);
        return fromDoc(doc);
      },
      async find(ownerId, id) {
        return fromDoc(await (await collection()).findOne({ _id: oid(id), owner: oid(ownerId) }));
      },
      async list(ownerId, { sortBy = 'createdAt', descending = true, offset = 0, limit = 10 } = {}) {
        const order = descending ? -1 : 1;
        const filter = { owner: oid(ownerId) };
        const target = await collection();
        const [docs, total] = await Promise.all([
          target
            .find(filter)
            .sort({ [sortBy]: order, _id: order })
            .skip(offset)
            .limit(limit)
            .toArray(),
          target.countDocuments(filter),
        ]);
        return { results: docs.map((doc) => fromDoc(doc)), total };
      },
      async update(ownerId, id, changes) {
        const doc = await (
          await collection()
        ).findOneAndUpdate(
          { _id: oid(id), owner: oid(ownerId) },
          { $set: { ...changes, updatedAt: new Date() } },
          { returnDocument: 'after' }
        );
        return fromDoc(doc);
      },
      async remove(ownerId, id) {
        const { deletedCount } = await (await collection()).deleteOne({ _id: oid(id), owner: oid(ownerId) });
        return deletedCount === 1;
      },
      async removeAllOf(ownerId) {
        await (await collection()).deleteMany({ owner: oid(ownerId) });
      },
    };
  };

  const users = {
    async create(data) {
      const now = new Date();
      const doc = {
        _id: oid(data.id),
        name: String(data.name),
        email: String(data.email),
        password: String(data.password),
        role: String(data.role),
        isEmailVerified: Boolean(data.isEmailVerified),
        locale: String(data.locale),
        twoFactor: emptyTwoFactor(),
        failedLoginAttempts: 0,
        credentialsChangedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await col('users').insertOne(doc);
      return fromUserDoc(doc);
    },
    async findById(id) {
      return fromUserDoc(await col('users').findOne({ _id: oid(id) }));
    },
    async findByEmail(email) {
      return fromUserDoc(await col('users').findOne({ email: String(email) }));
    },
    async emailTaken(email, exceptId) {
      const filter = { email: String(email) };
      if (exceptId) {
        filter._id = { $ne: oid(exceptId) };
      }
      return (await col('users').countDocuments(filter, { limit: 1 })) > 0;
    },
    async update(id, changes) {
      const set = { updatedAt: new Date() };
      const unset = {};
      Object.entries(changes).forEach(([field, value]) => {
        if (!USER_FIELDS.has(field)) {
          throw new Error(`Unknown user field ${field}`);
        }
        if (value === null) {
          unset[field] = 1;
        } else {
          set[field] = value;
        }
      });
      const update = Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set };
      const { matchedCount } = await col('users').updateOne({ _id: oid(id) }, update);
      return matchedCount === 1;
    },
    async incrementFailedLogins(id) {
      const doc = await col('users').findOneAndUpdate(
        { _id: oid(id) },
        { $inc: { failedLoginAttempts: 1 } },
        { returnDocument: 'after', projection: { failedLoginAttempts: 1 } }
      );
      return doc?.failedLoginAttempts ?? 0;
    },
    async advanceTotpStep(id, step) {
      const { modifiedCount } = await col('users').updateOne(
        // $not also matches documents without the field, which then get it; a used or older step never matches.
        { _id: oid(id), 'twoFactor.lastUsedStep': { $not: { $gte: Number(step) } } },
        { $set: { 'twoFactor.lastUsedStep': Number(step) } }
      );
      return modifiedCount === 1;
    },
    async useRecoveryCode(id, hash) {
      const { modifiedCount } = await col('users').updateOne(
        { _id: oid(id), 'twoFactor.recoveryCodes': String(hash) },
        { $pull: { 'twoFactor.recoveryCodes': String(hash) } }
      );
      return modifiedCount === 1;
    },
    async remove(id) {
      const { deletedCount } = await col('users').deleteOne({ _id: oid(id) });
      return deletedCount === 1;
    },
    async list({ role, search } = {}, { sortBy = 'createdAt', descending = true, offset = 0, limit = 10 } = {}) {
      const filter = {};
      if (role) {
        filter.role = String(role);
      }
      if (search) {
        const pattern = { $regex: escapeRegExp(String(search)), $options: 'i' };
        filter.$or = [{ name: pattern }, { email: pattern }];
      }
      const order = descending ? -1 : 1;
      const [docs, total] = await Promise.all([
        col('users')
          .find(filter)
          .sort({ [sortBy]: order, _id: order })
          .skip(offset)
          .limit(limit)
          .toArray(),
        col('users').countDocuments(filter),
      ]);
      return { results: docs.map((doc) => fromUserDoc(doc)), total };
    },
    count() {
      return col('users').countDocuments();
    },
  };

  const tokenFilter = ({ tokenHash, type, userId, family, validAt }) => {
    const filter = {};
    if (tokenHash !== undefined) filter.tokenHash = String(tokenHash);
    if (type !== undefined) filter.type = String(type);
    if (userId !== undefined) filter.user = oid(userId);
    if (family !== undefined) filter.family = String(family);
    if (validAt !== undefined) filter.expires = { $gt: validAt };
    return filter;
  };

  const tokens = {
    async create(data) {
      const doc = {
        _id: oid(data.id),
        tokenHash: String(data.tokenHash),
        user: oid(data.userId),
        type: String(data.type),
        expires: data.expires,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      ['family', 'device', 'startedAt', 'email'].forEach((field) => {
        if (data[field] !== undefined && data[field] !== null) doc[field] = data[field];
      });
      await col('tokens').insertOne(doc);
      return fromTokenDoc(doc);
    },
    async take(query) {
      return fromTokenDoc(await col('tokens').findOneAndDelete(tokenFilter(query)));
    },
    async find(query) {
      return fromTokenDoc(await col('tokens').findOne(tokenFilter(query)));
    },
    async exists(query) {
      return (await col('tokens').countDocuments(tokenFilter(query), { limit: 1 })) > 0;
    },
    async remove(query) {
      const { deletedCount } = await col('tokens').deleteMany(tokenFilter(query));
      return deletedCount;
    },
    async list(query) {
      const docs = await col('tokens').find(tokenFilter(query)).sort({ createdAt: -1, _id: -1 }).toArray();
      return docs.map((doc) => fromTokenDoc(doc));
    },
    count(query = {}) {
      return col('tokens').countDocuments(tokenFilter(query));
    },
  };

  const audit = {
    async add({ userId, type, device }) {
      const doc = { user: oid(userId), type: String(type), createdAt: new Date() };
      if (device) doc.device = String(device);
      await col('auditevents').insertOne(doc);
    },
    async list(userId, limit) {
      const docs = await col('auditevents')
        .find({ user: oid(userId) })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .toArray();
      return docs.map((doc) => auditRecord(doc));
    },
    async types(userId) {
      const docs = await col('auditevents')
        .find({ user: oid(userId) })
        .toArray();
      return docs.map((doc) => doc.type);
    },
    async removeForUser(userId) {
      await col('auditevents').deleteMany({ user: oid(userId) });
    },
  };

  const sessions = {
    async get(sid, now) {
      const doc = await col('web_sessions').findOne({ _id: String(sid), expiresAt: { $gt: now } });
      return doc ? doc.data : null;
    },
    async set(sid, data, expiresAt) {
      await col('web_sessions').updateOne(
        { _id: String(sid) },
        { $set: { data: String(data), expiresAt } },
        { upsert: true }
      );
    },
    async touch(sid, expiresAt) {
      await col('web_sessions').updateOne({ _id: String(sid) }, { $set: { expiresAt } });
    },
    async destroy(sid) {
      await col('web_sessions').deleteOne({ _id: String(sid) });
    },
  };

  const rateLimits = {
    async increment(key, windowMs, now, attempt = 0) {
      const expired = { $or: [{ $eq: [{ $type: '$expiresAt' }, 'missing'] }, { $lte: ['$expiresAt', now] }] };
      try {
        const doc = await col('rate_limits').findOneAndUpdate(
          { _id: String(key) },
          [
            {
              $set: {
                hits: { $cond: [expired, 1, { $add: ['$hits', 1] }] },
                expiresAt: { $cond: [expired, new Date(now.getTime() + windowMs), '$expiresAt'] },
              },
            },
          ],
          { upsert: true, returnDocument: 'after' }
        );
        return { hits: doc.hits, expiresAt: doc.expiresAt };
      } catch (error) {
        // Two first requests can race on the upsert; the second one simply retries.
        if (error.code === 11000 && attempt < 2) {
          return rateLimits.increment(key, windowMs, now, attempt + 1);
        }
        throw error;
      }
    },
    async decrement(key) {
      await col('rate_limits').updateOne({ _id: String(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
    },
    async reset(key) {
      await col('rate_limits').deleteOne({ _id: String(key) });
    },
  };

  return {
    kind: 'mongodb',
    dialect: 'mongodb',
    async connect() {
      await client.connect();
      db = client.db(dbName);
      await ensureIndexes();
    },
    async disconnect() {
      await client.close();
    },
    async ping() {
      try {
        await db.command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    },
    // TTL indexes remove expired tokens, sessions, rate-limit windows and old audit events on their own.
    async purgeExpired() {},
    async clear() {
      const names = ['users', 'tokens', 'auditevents', 'web_sessions', 'rate_limits', ...ownedCollections];
      await Promise.all(names.map((name) => col(name).deleteMany({})));
    },
    async drop() {
      await db.dropDatabase();
    },
    users,
    tokens,
    audit,
    sessions,
    rateLimits,
    owned,
  };
};

module.exports = { createMongoAdapter };
