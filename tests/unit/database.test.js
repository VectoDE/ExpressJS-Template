// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const path = require('node:path');
const { createDatabase, knexConfigFor, sqliteFile } = require('../../src/db');
const DatabaseSessionStore = require('../../src/db/sessionStore');
const { likePattern } = require('../../src/db/sql');
const { newId, isId } = require('../../src/utils/id');

const ROOT = path.join(__dirname, '../..');

describe('DATABASE_URL', () => {
  it('reads SQLite paths relative to the project, absolute or in memory', () => {
    expect(sqliteFile('sqlite::memory:')).toBe(':memory:');
    expect(sqliteFile('sqlite:')).toBe(':memory:');
    expect(sqliteFile('sqlite:data/app.db')).toBe(path.resolve(ROOT, 'data/app.db'));
    expect(sqliteFile('sqlite:///var/lib/app.db')).toBe('/var/lib/app.db');
    expect(sqliteFile('sqlite:///C:/data/app.db')).toBe('C:/data/app.db');
  });

  it('maps every scheme to its driver', () => {
    expect(knexConfigFor('sqlite', 'sqlite::memory:')).toMatchObject({ client: 'better-sqlite3' });
    expect(knexConfigFor('postgres', 'postgres://u:p@h/db')).toMatchObject({ client: 'pg' });
    expect(knexConfigFor('postgresql', 'postgresql://u:p@h/db')).toMatchObject({ client: 'pg' });
    expect(knexConfigFor('mysql', 'mysql://u:p@h/db')).toMatchObject({
      client: 'mysql2',
      connection: 'mysql://u:p@h/db',
    });
    expect(knexConfigFor('mariadb', 'mariadb://u:p@h/db')).toMatchObject({ connection: 'mysql://u:p@h/db' });
  });

  it('splits SQL Server URLs and decodes credentials', () => {
    const config = knexConfigFor('sqlserver', 'sqlserver://sa:p%40ss@db.local/app?trustServerCertificate=true');
    expect(config).toMatchObject({
      client: 'mssql',
      connection: {
        server: 'db.local',
        port: 1433,
        user: 'sa',
        password: 'p@ss',
        database: 'app',
        options: { encrypt: true, trustServerCertificate: true },
      },
    });
    const plain = knexConfigFor('mssql', 'mssql://sa:pw@db.local:1444/app?encrypt=false');
    expect(plain.connection).toMatchObject({ port: 1444, options: { encrypt: false, trustServerCertificate: false } });
  });

  it('builds an Oracle connect string', () => {
    expect(knexConfigFor('oracle', 'oracle://app:pw@db.local/FREEPDB1').connection).toEqual({
      user: 'app',
      password: 'pw',
      connectString: 'db.local:1521/FREEPDB1',
    });
  });

  it('refuses unknown schemes', () => {
    expect(() => createDatabase({ url: 'redis://localhost', name: 'x', auditRetentionDays: 1 })).toThrow(
      'scheme "redis" is not supported'
    );
  });

  it('picks the adapter by scheme', () => {
    expect(createDatabase({ url: 'mongodb://127.0.0.1:1/x', name: 'x', auditRetentionDays: 1 }).kind).toBe('mongodb');
    const sql = createDatabase({ url: 'postgres://u:p@127.0.0.1:1/x', name: 'x', auditRetentionDays: 1 });
    expect(sql).toMatchObject({ kind: 'sql', dialect: 'postgresql' });
    return sql.disconnect();
  });
});

describe('record ids', () => {
  it('look like MongoDB ObjectIds and start with the creation second', () => {
    const id = newId();
    expect(isId(id)).toBe(true);
    expect(Math.abs(Number.parseInt(id.slice(0, 8), 16) - Date.now() / 1000)).toBeLessThan(5);
    expect(isId('zz'.repeat(12))).toBe(false);
    expect(isId(42)).toBe(false);
  });
});

describe('SQL search pattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(likePattern('50%_[x]!')).toBe('%50!%!_![x]!!%');
    expect(likePattern('ABC')).toBe('%abc%');
  });
});

describe('DatabaseSessionStore', () => {
  const saved = new Map();
  const fakeDb = (failing = false) => ({
    sessions: {
      get: async (sid) => {
        if (failing) throw new Error('down');
        return saved.get(sid) ?? null;
      },
      set: async (sid, data) => {
        if (failing) throw new Error('down');
        saved.set(sid, data);
      },
      touch: async () => {
        if (failing) throw new Error('down');
      },
      destroy: async (sid) => {
        if (failing) throw new Error('down');
        saved.delete(sid);
      },
    },
  });
  const storeOn = (db, secret = 'a'.repeat(40)) => new DatabaseSessionStore({ db, secret, idleTimeoutMs: 60000 });
  const call = (fn) => new Promise((resolve) => fn((error, value) => resolve({ error, value })));

  it('stores sessions encrypted and reads them back', async () => {
    const store = storeOn(fakeDb());
    // A value long enough that random ciphertext cannot contain it by chance, unlike a short one such as "u1".
    const userId = 'plaintext-user-id-marker';
    await call((done) => store.set('s1', { cookie: {}, userId }, done));
    expect(saved.get('s1')).toMatch(/^v1\./);
    expect(saved.get('s1')).not.toContain(userId);
    expect((await call((done) => store.get('s1', done))).value).toEqual({ cookie: {}, userId });
    expect((await call((done) => store.get('missing', done))).value).toBeNull();
  });

  it('treats tampered data, another secret or an unknown format as no session', async () => {
    const store = storeOn(fakeDb());
    await call((done) => store.set('s2', { cookie: {} }, done));
    const [version, iv, tag, data] = saved.get('s2').split('.');
    // Flip one bit of the ciphertext. Swapping characters of the text could leave the bytes unchanged by chance.
    const tampered = Buffer.from(data, 'base64url');
    tampered[0] ^= 1;
    saved.set('s2', [version, iv, tag, tampered.toString('base64url')].join('.'));
    expect((await call((done) => store.get('s2', done))).value).toBeNull();

    await call((done) => store.set('s3', { cookie: {} }, done));
    expect((await call((done) => storeOn(fakeDb(), 'b'.repeat(40)).get('s3', done))).value).toBeNull();

    saved.set('s4', 'v0.a.b.c');
    expect((await call((done) => store.get('s4', done))).value).toBeNull();
    saved.set('s5', 'v1.only-two');
    expect((await call((done) => store.get('s5', done))).value).toBeNull();
  });

  it('uses the cookie expiry or the idle timeout', () => {
    const store = storeOn(fakeDb());
    const expires = new Date(Date.now() + 5000);
    expect(store.expiresAt({ cookie: { expires } }).getTime()).toBe(expires.getTime());
    expect(store.expiresAt({ cookie: {} }).getTime()).toBeGreaterThan(Date.now() + 59000);
  });

  it('touches and destroys sessions', async () => {
    const store = storeOn(fakeDb());
    await call((done) => store.set('s6', { cookie: {} }, done));
    expect((await call((done) => store.touch('s6', { cookie: {} }, done))).error).toBeNull();
    expect((await call((done) => store.destroy('s6', done))).error).toBeNull();
    expect(saved.has('s6')).toBe(false);
  });

  it('passes database errors to express-session', async () => {
    const store = storeOn(fakeDb(true));
    for (const action of [
      (done) => store.get('x', done),
      (done) => store.set('x', { cookie: {} }, done),
      (done) => store.touch('x', { cookie: {} }, done),
      (done) => store.destroy('x', done),
    ]) {
      expect((await call(action)).error.message).toBe('down');
    }
  });
});
