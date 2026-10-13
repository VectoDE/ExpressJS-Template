// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const fs = require('node:fs');
const path = require('node:path');
const knexFactory = require('knex');
const { userRecord, tokenRecord, passkeyRecord, auditRecord, toDate } = require('./records');
const migrations = require('./migrations');

/**
 * SQL adapter on Knex: SQLite, PostgreSQL, MySQL, MariaDB, Microsoft SQL Server and Oracle with one code path.
 * Times are stored as milliseconds since 1970 (BIGINT), so every database compares and sorts them the same way.
 * Every value is passed as a bound parameter; nothing from a request is ever part of the SQL text.
 */

const ms = (date) => (date ? toDate(date).getTime() : null);

const toSnake = (name) => name.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const toCamel = (name) => name.replaceAll(/_([a-z\d])/g, (match, letter) => letter.toUpperCase());

// Search text matches literally: %, _, [ and the escape character itself lose their meaning in LIKE.
const likePattern = (value) =>
  `%${String(value)
    .toLowerCase()
    .replaceAll(/[!%_[]/g, '!$&')}%`;

const SORT_COLUMNS = { name: 'name', email: 'email', role: 'role', createdAt: 'created_at', updatedAt: 'updated_at' };

const USER_COLUMNS = {
  name: 'name',
  email: 'email',
  password: 'password',
  role: 'role',
  isEmailVerified: 'is_email_verified',
  locale: 'locale',
  credentialsChangedAt: 'credentials_changed_at',
  failedLoginAttempts: 'failed_login_attempts',
  lockUntil: 'lock_until',
};
const TIME_FIELDS = new Set(['credentialsChangedAt', 'lockUntil']);

const isUniqueViolation = (error) =>
  error.code === '23505' || // PostgreSQL, CockroachDB
  error.code === 'ER_DUP_ENTRY' || // MySQL, MariaDB
  String(error.code).startsWith('SQLITE_CONSTRAINT') ||
  error.number === 2627 || // SQL Server
  error.number === 2601 ||
  error.errorNum === 1; // Oracle ORA-00001

const fromUserRow = (row, recoveryCodes) =>
  (row ?? null) &&
  userRecord({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    isEmailVerified: row.is_email_verified,
    locale: row.locale,
    credentialsChangedAt: row.credentials_changed_at,
    failedLoginAttempts: row.failed_login_attempts,
    lockUntil: row.lock_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    twoFactor: {
      enabled: row.two_factor_enabled,
      secret: row.two_factor_secret,
      pendingSecret: row.two_factor_pending_secret,
      lastUsedStep: row.two_factor_last_used_step,
      enabledAt: row.two_factor_enabled_at,
      recoveryCodes,
    },
  });

const fromTokenRow = (row) =>
  (row ?? null) &&
  tokenRecord({
    id: row.id,
    tokenHash: row.token_hash,
    userId: row.user_id,
    type: row.type,
    expires: row.expires,
    family: row.family,
    device: row.device,
    startedAt: row.started_at,
    email: row.email,
    createdAt: row.created_at,
  });

const fromPasskeyRow = (row) =>
  (row ?? null) &&
  passkeyRecord({
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: row.transports,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });

const createSqlAdapter = ({ knexConfig, dialect, migrate = true }) => {
  const knex = knexFactory(knexConfig);

  const recoveryCodesOf = async (trx, userId) =>
    (await trx('recovery_codes').where({ user_id: userId }).select('code_hash')).map((row) => row.code_hash);

  const loadUser = async (query) => {
    const row = await query.first();
    return row ? fromUserRow(row, await recoveryCodesOf(knex, row.id)) : null;
  };

  const twoFactorColumns = (twoFactor) => ({
    two_factor_enabled: Boolean(twoFactor.enabled),
    two_factor_secret: twoFactor.secret ?? null,
    two_factor_pending_secret: twoFactor.pendingSecret ?? null,
    two_factor_last_used_step: Number(twoFactor.lastUsedStep ?? -1),
    two_factor_enabled_at: ms(twoFactor.enabledAt),
  });

  const users = {
    async create(data) {
      const now = Date.now();
      const row = {
        id: data.id,
        name: String(data.name),
        email: String(data.email),
        password: String(data.password),
        role: String(data.role),
        is_email_verified: Boolean(data.isEmailVerified),
        locale: String(data.locale),
        credentials_changed_at: now,
        failed_login_attempts: 0,
        lock_until: null,
        ...twoFactorColumns({}),
        created_at: now,
        updated_at: now,
      };
      await knex('users').insert(row);
      return fromUserRow(row, []);
    },
    // Stores a complete record from another database: id, timestamps, password hash and second factor as they are.
    restore(user) {
      const row = {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email),
        password: String(user.password),
        role: String(user.role),
        is_email_verified: Boolean(user.isEmailVerified),
        locale: String(user.locale),
        credentials_changed_at: ms(user.credentialsChangedAt),
        failed_login_attempts: Number(user.failedLoginAttempts) || 0,
        lock_until: ms(user.lockUntil),
        ...twoFactorColumns(user.twoFactor || {}),
        created_at: ms(user.createdAt),
        updated_at: ms(user.updatedAt),
      };
      const codes = user.twoFactor?.recoveryCodes || [];
      return knex.transaction(async (trx) => {
        await trx('users').insert(row);
        if (codes.length) {
          await trx('recovery_codes').insert(codes.map((hash) => ({ user_id: row.id, code_hash: String(hash) })));
        }
      });
    },
    findById(id) {
      return loadUser(knex('users').where({ id: String(id) }));
    },
    findByEmail(email) {
      return loadUser(knex('users').where({ email: String(email) }));
    },
    async emailTaken(email, exceptId) {
      const query = knex('users').where({ email: String(email) });
      if (exceptId) {
        query.whereNot({ id: String(exceptId) });
      }
      return Boolean(await query.first('id'));
    },
    async update(id, changes) {
      const row = { updated_at: Date.now() };
      let recoveryCodes;
      Object.entries(changes).forEach(([field, value]) => {
        if (field === 'twoFactor') {
          Object.assign(row, twoFactorColumns(value));
          recoveryCodes = value.recoveryCodes || [];
        } else if (USER_COLUMNS[field]) {
          row[USER_COLUMNS[field]] = TIME_FIELDS.has(field) ? ms(value) : value;
        } else {
          throw new Error(`Unknown user field ${field}`);
        }
      });
      return knex.transaction(async (trx) => {
        const updated = await trx('users')
          .where({ id: String(id) })
          .update(row);
        if (updated === 1 && recoveryCodes) {
          await trx('recovery_codes')
            .where({ user_id: String(id) })
            .del();
          if (recoveryCodes.length) {
            await trx('recovery_codes').insert(recoveryCodes.map((hash) => ({ user_id: String(id), code_hash: hash })));
          }
        }
        return updated === 1;
      });
    },
    incrementFailedLogins(id) {
      return knex.transaction(async (trx) => {
        await trx('users')
          .where({ id: String(id) })
          .update({ failed_login_attempts: trx.raw('?? + 1', ['failed_login_attempts']) });
        const row = await trx('users')
          .where({ id: String(id) })
          .first('failed_login_attempts');
        return Number(row?.failed_login_attempts ?? 0);
      });
    },
    async advanceTotpStep(id, step) {
      const updated = await knex('users')
        .where({ id: String(id) })
        .andWhere('two_factor_last_used_step', '<', Number(step))
        .update({ two_factor_last_used_step: Number(step) });
      return updated === 1;
    },
    async useRecoveryCode(id, hash) {
      const removed = await knex('recovery_codes')
        .where({ user_id: String(id), code_hash: String(hash) })
        .del();
      return removed === 1;
    },
    remove(id) {
      return knex.transaction(async (trx) => {
        await trx('recovery_codes')
          .where({ user_id: String(id) })
          .del();
        return (
          (await trx('users')
            .where({ id: String(id) })
            .del()) === 1
        );
      });
    },
    async list({ role, search } = {}, { sortBy = 'createdAt', descending = true, offset = 0, limit = 10 } = {}) {
      const filtered = () => {
        const query = knex('users');
        if (role) {
          query.where({ role: String(role) });
        }
        if (search) {
          const pattern = likePattern(search);
          query.where((builder) =>
            builder
              .whereRaw('lower(??) like ? escape ?', ['name', pattern, '!'])
              .orWhereRaw('lower(??) like ? escape ?', ['email', pattern, '!'])
          );
        }
        return query;
      };
      const direction = descending ? 'desc' : 'asc';
      const [rows, countRow] = await Promise.all([
        filtered()
          .orderBy([
            { column: SORT_COLUMNS[sortBy], order: direction },
            { column: 'id', order: direction },
          ])
          .offset(offset)
          .limit(limit),
        filtered().count({ total: '*' }).first(),
      ]);
      const ids = rows.map((row) => row.id);
      const codes = ids.length
        ? await knex('recovery_codes').whereIn('user_id', ids).select('user_id', 'code_hash')
        : [];
      const results = rows.map((row) =>
        fromUserRow(
          row,
          codes.filter((code) => code.user_id === row.id).map((code) => code.code_hash)
        )
      );
      return { results, total: Number(countRow.total) };
    },
    async count() {
      return Number((await knex('users').count({ total: '*' }).first()).total);
    },
  };

  const tokenQuery = (db, { tokenHash, type, userId, family, validAt }) => {
    const query = db('tokens');
    if (tokenHash !== undefined) query.where({ token_hash: String(tokenHash) });
    if (type !== undefined) query.where({ type: String(type) });
    if (userId !== undefined) query.where({ user_id: String(userId) });
    if (family !== undefined) query.where({ family: String(family) });
    if (validAt !== undefined) query.where('expires', '>', ms(validAt));
    return query;
  };

  const tokens = {
    async create(data) {
      const row = {
        id: data.id,
        token_hash: String(data.tokenHash),
        user_id: String(data.userId),
        type: String(data.type),
        expires: ms(data.expires),
        family: data.family ?? null,
        device: data.device ?? null,
        started_at: ms(data.startedAt),
        email: data.email ?? null,
        created_at: Date.now(),
      };
      await knex('tokens').insert(row);
      return fromTokenRow(row);
    },
    // Find and delete: only the caller whose DELETE removed the row gets the token, so it works exactly once.
    async take(query) {
      const row = await tokenQuery(knex, query).first();
      if (!row) {
        return null;
      }
      const removed = await knex('tokens').where({ id: row.id }).del();
      return removed === 1 ? fromTokenRow(row) : null;
    },
    async find(query) {
      return fromTokenRow(await tokenQuery(knex, query).first());
    },
    async exists(query) {
      return Boolean(await tokenQuery(knex, query).first('id'));
    },
    remove(query) {
      return tokenQuery(knex, query).del();
    },
    async list(query) {
      const rows = await tokenQuery(knex, query).orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]);
      return rows.map((row) => fromTokenRow(row));
    },
    async count(query = {}) {
      return Number((await tokenQuery(knex, query).count({ total: '*' }).first()).total);
    },
  };

  const passkeys = {
    async create(data) {
      const row = {
        id: data.id,
        user_id: String(data.userId),
        credential_id: String(data.credentialId),
        public_key: String(data.publicKey),
        counter: Number(data.counter) || 0,
        transports: (data.transports || []).map(String).join(','),
        name: String(data.name),
        created_at: ms(data.createdAt) ?? Date.now(),
        last_used_at: ms(data.lastUsedAt),
      };
      await knex('passkeys').insert(row);
      return fromPasskeyRow(row);
    },
    async listForUser(userId) {
      const rows = await knex('passkeys')
        .where({ user_id: String(userId) })
        .orderBy([
          { column: 'created_at', order: 'asc' },
          { column: 'id', order: 'asc' },
        ]);
      return rows.map((row) => fromPasskeyRow(row));
    },
    async recordUse(userId, id, counter, at) {
      const updated = await knex('passkeys')
        .where({ id: String(id), user_id: String(userId) })
        .update({ counter: Number(counter) || 0, last_used_at: ms(at) });
      return updated === 1;
    },
    async remove(userId, id) {
      return (
        (await knex('passkeys')
          .where({ id: String(id), user_id: String(userId) })
          .del()) === 1
      );
    },
    async removeForUser(userId) {
      await knex('passkeys')
        .where({ user_id: String(userId) })
        .del();
    },
  };

  const audit = {
    async add({ id, userId, type, device }) {
      await knex('audit_events').insert({
        id,
        user_id: String(userId),
        type: String(type),
        device: device ? String(device) : null,
        created_at: Date.now(),
      });
    },
    async restore({ id, userId, type, device, createdAt }) {
      await knex('audit_events').insert({
        id,
        user_id: String(userId),
        type: String(type),
        device: device ? String(device) : null,
        created_at: ms(createdAt),
      });
    },
    async list(userId, limit) {
      const rows = await knex('audit_events')
        .where({ user_id: String(userId) })
        .orderBy([
          { column: 'created_at', order: 'desc' },
          { column: 'id', order: 'desc' },
        ])
        .limit(limit);
      return rows.map((row) => auditRecord({ type: row.type, device: row.device, createdAt: row.created_at }));
    },
    async types(userId) {
      return (
        await knex('audit_events')
          .where({ user_id: String(userId) })
          .select('type')
      ).map((row) => row.type);
    },
    async removeForUser(userId) {
      await knex('audit_events')
        .where({ user_id: String(userId) })
        .del();
    },
  };

  const sessions = {
    async get(sid, now) {
      const row = await knex('web_sessions')
        .where({ id: String(sid) })
        .andWhere('expires_at', '>', ms(now))
        .first('data');
      return row ? row.data : null;
    },
    async set(sid, data, expiresAt) {
      const row = { data: String(data), expires_at: ms(expiresAt) };
      const updated = await knex('web_sessions')
        .where({ id: String(sid) })
        .update(row);
      if (updated === 0) {
        try {
          await knex('web_sessions').insert({ id: String(sid), ...row });
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          await knex('web_sessions')
            .where({ id: String(sid) })
            .update(row);
        }
      }
    },
    async touch(sid, expiresAt) {
      await knex('web_sessions')
        .where({ id: String(sid) })
        .update({ expires_at: ms(expiresAt) });
    },
    async destroy(sid) {
      await knex('web_sessions')
        .where({ id: String(sid) })
        .del();
    },
  };

  const rateLimits = {
    // Three conditional statements instead of a transaction: count up a running window, restart an expired
    // one, or create a new one. Each step is atomic on its own, so parallel requests are never lost.
    async increment(key, windowMs, now, attempt = 0) {
      const id = String(key);
      const at = ms(now);
      let changed = await knex('rate_limits')
        .where({ id })
        .andWhere('expires_at', '>', at)
        .update({ hits: knex.raw('?? + 1', ['hits']) });
      if (changed === 0) {
        changed = await knex('rate_limits')
          .where({ id })
          .andWhere('expires_at', '<=', at)
          .update({ hits: 1, expires_at: at + windowMs });
      }
      if (changed === 0) {
        try {
          await knex('rate_limits').insert({ id, hits: 1, expires_at: at + windowMs });
        } catch (error) {
          if (isUniqueViolation(error) && attempt < 2) {
            return rateLimits.increment(key, windowMs, now, attempt + 1);
          }
          throw error;
        }
      }
      const row = await knex('rate_limits').where({ id }).first('hits', 'expires_at');
      return { hits: Number(row.hits), expiresAt: toDate(row.expires_at) };
    },
    async decrement(key) {
      await knex('rate_limits')
        .where({ id: String(key) })
        .andWhere('hits', '>', 0)
        .update({ hits: knex.raw('?? - 1', ['hits']) });
    },
    async reset(key) {
      await knex('rate_limits')
        .where({ id: String(key) })
        .del();
    },
  };

  const TABLES = ['passkeys', 'recovery_codes', 'tokens', 'audit_events', 'web_sessions', 'rate_limits', 'users'];
  const ownedTables = new Set();

  /**
   * Records that belong to one account, for resources made with `npm run generate`. Every call filters on the
   * owner, so one account can never read or change another account's records. Field names are camelCase in code
   * and snake_case in the table; createdAt and updatedAt are kept as milliseconds.
   */
  const owned = (table) => {
    ownedTables.add(table);
    const fromRow = (row) =>
      (row ?? null) &&
      Object.fromEntries(
        Object.entries(row)
          .filter(([column]) => column !== 'owner_id')
          .map(([column, value]) => [toCamel(column), column.endsWith('_at') ? toDate(value) : value])
      );
    const toRow = (data) => Object.fromEntries(Object.entries(data).map(([field, value]) => [toSnake(field), value]));
    const mine = (ownerId) => knex(table).where({ owner_id: String(ownerId) });
    return {
      async create(ownerId, { id, ...data }) {
        const now = Date.now();
        const row = { ...toRow(data), id, owner_id: String(ownerId), created_at: now, updated_at: now };
        await knex(table).insert(row);
        return fromRow(row);
      },
      async find(ownerId, id) {
        return fromRow(
          await mine(ownerId)
            .where({ id: String(id) })
            .first()
        );
      },
      async list(ownerId, { sortBy = 'createdAt', descending = true, offset = 0, limit = 10 } = {}) {
        const direction = descending ? 'desc' : 'asc';
        const [rows, countRow] = await Promise.all([
          mine(ownerId)
            .orderBy([
              { column: toSnake(sortBy), order: direction },
              { column: 'id', order: direction },
            ])
            .offset(offset)
            .limit(limit),
          mine(ownerId).count({ total: '*' }).first(),
        ]);
        return { results: rows.map((row) => fromRow(row)), total: Number(countRow.total) };
      },
      async update(ownerId, id, changes) {
        const changed = await mine(ownerId)
          .where({ id: String(id) })
          .update({ ...toRow(changes), updated_at: Date.now() });
        return changed === 1 ? this.find(ownerId, id) : null;
      },
      async remove(ownerId, id) {
        return (
          (await mine(ownerId)
            .where({ id: String(id) })
            .del()) === 1
        );
      },
      async removeAllOf(ownerId) {
        await mine(ownerId).del();
      },
    };
  };

  return {
    kind: 'sql',
    dialect,
    // The Knex instance, for own queries and schema changes beyond the methods below.
    knex,
    async connect() {
      const filename = knexConfig.connection?.filename;
      if (filename && filename !== ':memory:') {
        // The file name comes from DATABASE_URL, which only the operator sets.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
      }
      if (migrate) {
        await knex.migrate.latest({ migrationSource: migrations });
        return;
      }
      const [, pending] = await knex.migrate.list({ migrationSource: migrations });
      if (pending.length) {
        const names = pending.map((migration) => migration.name).join(', ');
        throw new Error(`The database schema is not up to date (${names}). Run "npm run migrate" first.`);
      }
    },
    // Applies pending migrations; returns the names of the ones that ran.
    async migrate() {
      const [, applied] = await knex.migrate.latest({ migrationSource: migrations });
      return applied;
    },
    async disconnect() {
      await knex.destroy();
    },
    async ping() {
      try {
        await knex.raw(dialect === 'oracle' ? 'select 1 from dual' : 'select 1');
        return true;
      } catch {
        return false;
      }
    },
    async purgeExpired(now, auditBefore) {
      const at = ms(now);
      await Promise.all([
        knex('tokens').where('expires', '<=', at).del(),
        knex('web_sessions').where('expires_at', '<=', at).del(),
        knex('rate_limits').where('expires_at', '<=', at).del(),
        knex('audit_events').where('created_at', '<', ms(auditBefore)).del(),
      ]);
    },
    async clear() {
      // One table after the other: recovery codes before users, in case a database enforces the order.
      // Tables of generated resources count only while their migration is applied.
      const owned = await Promise.all(
        [...ownedTables].map(async (table) => (await knex.schema.hasTable(table)) && table)
      );
      const tables = [...owned.filter(Boolean), ...TABLES];
      await tables.reduce((previous, table) => previous.then(() => knex(table).del()), Promise.resolve());
    },
    async drop() {
      await knex.migrate.rollback({ migrationSource: migrations }, true);
    },
    users,
    tokens,
    passkeys,
    audit,
    sessions,
    rateLimits,
    owned,
  };
};

module.exports = { createSqlAdapter, likePattern };
