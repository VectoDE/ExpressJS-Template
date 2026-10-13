// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { registerD1Binding } = require('../../src/db/d1');
const { createSqlAdapter } = require('../../src/db/sql');
const { knexConfigFor } = require('../../src/db');
const { generateMigrationSql } = require('../../worker/d1-migrations');

const MIGRATIONS = path.join(__dirname, '../../worker/migrations');

/**
 * A stand-in for a D1 binding with the same surface the client uses: prepare(sql).bind(...).all() resolving to
 * { results, meta: { changes, last_row_id } }. Like D1 it refuses BEGIN/COMMIT, rejects undefined values and
 * reports constraint errors only in the message. Underneath is an in-memory SQLite database.
 */
const fakeD1 = () => {
  const sqlite = new Database(':memory:');
  const statements = [];
  const run = (sql, values) => {
    statements.push(sql);
    if (/^\s*(begin|commit|rollback)/i.test(sql)) {
      throw new Error('D1_ERROR: cannot start a transaction within a transaction');
    }
    if (values.some((value) => value === undefined)) {
      throw new Error('D1_TYPE_ERROR: Type undefined is not supported');
    }
    if ((sql.match(/union all/gi) || []).length > 4) {
      throw new Error('D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR');
    }
    try {
      const statement = sqlite.prepare(sql);
      if (statement.reader) {
        return { results: statement.all(values), meta: { changes: 0, last_row_id: 0 } };
      }
      const info = statement.run(values);
      return { results: [], meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
    } catch (error) {
      // D1 surfaces only the message, without SQLite's error code.
      throw new Error(`D1_ERROR: ${error.message}: ${error.code}`, { cause: error });
    }
  };
  const binding = {
    prepare: (sql) => {
      const make = (values) => ({
        bind: (...next) => make(next),
        all: async () => run(sql, values),
      });
      return make([]);
    },
  };
  return { binding, sqlite, statements };
};

const applyMigrations = (sqlite) => {
  fs.readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- migration files of this repository
    .forEach((name) => sqlite.exec(fs.readFileSync(path.join(MIGRATIONS, name), 'utf8')));
};

const user = (overrides = {}) => ({
  id: 'a'.repeat(24),
  name: 'Demo User',
  email: 'user@example.com',
  password: 'scrypt$1024$8$1$c2FsdA==$a2V5',
  role: 'user',
  isEmailVerified: false,
  locale: 'en',
  ...overrides,
});

describe('D1 Knex client', () => {
  let d1;
  let db;

  beforeEach(async () => {
    d1 = fakeD1();
    applyMigrations(d1.sqlite);
    registerD1Binding('TEST', d1.binding);
    db = createSqlAdapter({ knexConfig: knexConfigFor('d1', 'd1:TEST'), dialect: 'd1', migrate: 'external' });
    await db.connect();
  });

  afterEach(async () => {
    await db.disconnect();
    d1.sqlite.close();
  });

  it('leaves the schema to wrangler and runs no Knex migrations', () => {
    expect(d1.statements.some((sql) => /knex_migrations/.test(sql))).toBe(false);
  });

  it('creates, reads, updates and counts records through the binding', async () => {
    await db.users.create(user());
    const found = await db.users.findByEmail('user@example.com');
    expect(found).toMatchObject({ id: 'a'.repeat(24), role: 'user', isEmailVerified: false });
    expect(await db.users.update(found.id, { isEmailVerified: true, lockUntil: new Date(5000) })).toBe(true);
    const updated = await db.users.findById(found.id);
    expect(updated.isEmailVerified).toBe(true);
    expect(updated.lockUntil.getTime()).toBe(5000);
    expect(await db.users.count()).toBe(1);
    expect(await db.users.incrementFailedLogins(found.id)).toBe(1);
    await expect(db.ping()).resolves.toBe(true);
  });

  it('writes many rows at once as a VALUES list, which D1 accepts', async () => {
    await db.users.create(user());
    const codes = Array.from({ length: 10 }, (_, index) => `code-${index}`);
    await db.users.update('a'.repeat(24), { twoFactor: { enabled: true, secret: 's', recoveryCodes: codes } });
    expect((await db.users.findById('a'.repeat(24))).twoFactor.recoveryCodes).toHaveLength(10);
    expect(d1.statements.some((sql) => /insert into `recovery_codes` .* values \(\?, \?\), \(\?, \?\)/.test(sql))).toBe(
      true
    );
  });

  it('runs transactions without BEGIN or COMMIT (not atomic, demo only)', async () => {
    await db.users.create(user());
    expect(await db.users.remove('a'.repeat(24))).toBe(true);
    expect(d1.statements.some((sql) => /^\s*(begin|commit)/i.test(sql))).toBe(false);
  });

  it('reports unique violations with a SQLite code, so the adapter can recognise them', async () => {
    await db.users.create(user());
    const error = await db.users.create(user({ id: 'b'.repeat(24) })).catch((caught) => caught);
    expect(error.code).toBe('SQLITE_CONSTRAINT_UNIQUE');
  });

  it('keeps sessions and rate limits working, including the insert race fallback', async () => {
    await db.sessions.set('sid', 'payload', new Date(Date.now() + 60000));
    await db.sessions.set('sid', 'payload-2', new Date(Date.now() + 60000));
    expect(await db.sessions.get('sid', new Date())).toBe('payload-2');
    const first = await db.rateLimits.increment('ip', 60000, new Date());
    const second = await db.rateLimits.increment('ip', 60000, new Date());
    expect([first.hits, second.hits]).toEqual([1, 2]);
  });

  it('takes a token exactly once', async () => {
    await db.users.create(user());
    await db.tokens.create({
      id: 'c'.repeat(24),
      tokenHash: 'h',
      userId: 'a'.repeat(24),
      type: 'refresh',
      expires: new Date(Date.now() + 1000),
    });
    expect(await db.tokens.take({ tokenHash: 'h' })).toMatchObject({ userId: 'a'.repeat(24) });
    expect(await db.tokens.take({ tokenHash: 'h' })).toBeNull();
  });

  it('clears every table for the demo reset', async () => {
    await db.users.create(user());
    await db.clear();
    expect(await db.users.count()).toBe(0);
  });

  it('turns undefined bindings into NULL and keeps booleans and dates as numbers', () => {
    const { ClientD1 } = require('../../src/db/d1');
    const client = Object.create(ClientD1.prototype);
    expect(client._formatBindings([undefined, true, false, new Date(7), 'x'])).toEqual([null, 1, 0, 7, 'x']);
    expect(client._formatBindings()).toEqual([]);
  });

  it('fails clearly outside a Worker, where no binding is registered', async () => {
    const orphan = createSqlAdapter({
      knexConfig: knexConfigFor('d1', 'd1:MISSING'),
      dialect: 'd1',
      migrate: 'external',
    });
    await expect(orphan.ping()).resolves.toBe(false);
    await expect(orphan.users.count()).rejects.toThrow(/No D1 binding named "MISSING"/);
    await orphan.disconnect();
  });

  it('rejects empty queries and missing connections like the other Knex clients', async () => {
    const { ClientD1 } = require('../../src/db/d1');
    const client = Object.create(ClientD1.prototype);
    await expect(client._query({ binding: d1.binding }, { sql: '' })).rejects.toThrow(/empty/);
    await expect(client._query(null, { sql: 'select 1' })).rejects.toThrow(/No connection/);
    const other = await client
      ._query({ binding: { prepare: () => ({ all: () => Promise.reject(new Error('boom')) }) } }, { sql: 'select 1' })
      .catch((error) => error);
    expect(other.message).toBe('boom');
    expect(other.code).toBeUndefined();
  });
});

describe('D1 migrations', () => {
  it('match the Knex migrations (run npm run build:worker after adding one)', async () => {
    const generated = await generateMigrationSql();
    const files = fs.readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql'));
    expect(files.sort((a, b) => a.localeCompare(b))).toEqual(generated.map((file) => file.name));
    generated.forEach(({ name, sql }) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- migration files of this repository
      expect(fs.readFileSync(path.join(MIGRATIONS, name), 'utf8')).toBe(sql);
    });
  });
});
