const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createDatabase } = require('../../src/db');
const { newId } = require('../../src/utils/id');

/**
 * One contract for every adapter: the services rely on exactly this behaviour, whatever the database. The suite
 * always checks SQLite (in memory and as a file) and MongoDB, plus the database of TEST_DATABASE_URL when it is
 * another one, so CI covers every supported server.
 */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'db-contract-'));
const configured = process.env.DATABASE_URL;
let mongod;

const targets = [
  ['SQLite in memory', async () => 'sqlite::memory:'],
  [
    'SQLite file',
    async () => {
      // sqlite:///C:/dir/app.db on Windows, sqlite:///tmp/dir/app.db elsewhere; the folder does not exist yet.
      const file = path.join(tmp, 'nested', 'app.db').replaceAll('\\', '/');
      return `sqlite://${file.startsWith('/') ? '' : '/'}${file}`;
    },
  ],
  [
    'MongoDB',
    async () => {
      if (configured.startsWith('mongodb')) return configured;
      mongod ??= await MongoMemoryServer.create();
      return mongod.getUri();
    },
  ],
];
if (!configured.startsWith('sqlite') && !configured.startsWith('mongodb')) {
  targets.push(['configured database', async () => configured]);
}

afterAll(async () => {
  await mongod?.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const HOUR = 60 * 60 * 1000;

describe.each(targets)('%s', (label, urlFor) => {
  let db;

  const user = (overrides = {}) =>
    db.users.create({
      id: newId(),
      name: 'Ada Lovelace',
      email: `${newId()}@example.com`,
      password: 'scrypt$hash',
      role: 'user',
      isEmailVerified: false,
      locale: 'en',
      ...overrides,
    });

  beforeAll(async () => {
    db = createDatabase({
      url: await urlFor(),
      name: `contract_${process.env.JEST_WORKER_ID}`,
      auditRetentionDays: 30,
    });
    await db.connect();
    // A second connect must not fail: the preview server and tests may call it more than once.
    if (db.kind === 'sql') await db.connect();
  });
  afterEach(() => db.clear());
  afterAll(async () => {
    await db.drop();
    await db.disconnect();
  });

  it('answers a ping', async () => {
    expect(await db.ping()).toBe(true);
  });

  it('has nothing left to migrate, and an app without schema rights connects', async () => {
    expect(await db.migrate()).toEqual(db.kind === 'sql' ? [] : ['indexes']);
    const url = await urlFor();
    // An in-memory SQLite database exists only inside its own connection.
    if (url === 'sqlite::memory:') return;
    const app = createDatabase({
      url,
      name: `contract_${process.env.JEST_WORKER_ID}`,
      auditRetentionDays: 30,
      migrate: false,
    });
    await app.connect();
    expect(await app.ping()).toBe(true);
    await app.disconnect();
  });

  describe('users', () => {
    it('stores, finds and hides secret fields from enumeration', async () => {
      const created = await user({ name: 'Grace' });
      const found = await db.users.findById(created.id);
      expect(found).toMatchObject({ id: created.id, name: 'Grace', role: 'user', isEmailVerified: false });
      expect(found.password).toBe('scrypt$hash');
      expect(found.twoFactor).toMatchObject({ enabled: false, recoveryCodes: [], lastUsedStep: -1 });
      expect(found.createdAt).toBeInstanceOf(Date);
      expect(Object.keys(found)).not.toContain('password');
      expect(JSON.stringify(found)).not.toContain('scrypt');
      expect((await db.users.findByEmail(created.email)).id).toBe(created.id);
    });

    it('returns null for unknown or malformed ids instead of throwing', async () => {
      expect(await db.users.findById(newId())).toBeNull();
      expect(await db.users.findById('not-an-id')).toBeNull();
      expect(await db.users.findByEmail('nobody@example.com')).toBeNull();
      expect(await db.users.remove('not-an-id')).toBe(false);
    });

    it('rejects a second account with the same email', async () => {
      const first = await user();
      await expect(user({ email: first.email })).rejects.toThrow();
      expect(await db.users.emailTaken(first.email)).toBe(true);
      expect(await db.users.emailTaken(first.email, first.id)).toBe(false);
      expect(await db.users.emailTaken('free@example.com')).toBe(false);
    });

    it('updates fields, clears them with null and refuses unknown ones', async () => {
      const created = await user();
      const lockUntil = new Date(Date.now() + HOUR);
      expect(await db.users.update(created.id, { name: 'Changed', lockUntil, isEmailVerified: true })).toBe(true);
      let found = await db.users.findById(created.id);
      expect(found).toMatchObject({ name: 'Changed', isEmailVerified: true });
      expect(found.lockUntil.getTime()).toBe(lockUntil.getTime());

      await db.users.update(created.id, { lockUntil: null });
      found = await db.users.findById(created.id);
      expect(found.lockUntil ?? null).toBeNull();

      await expect(db.users.update(created.id, { isAdmin: true })).rejects.toThrow('Unknown user field');
      expect(await db.users.update(newId(), { name: 'Nobody' })).toBe(false);
    });

    it('counts failed logins atomically', async () => {
      const created = await user();
      const counts = await Promise.all(Array.from({ length: 5 }, () => db.users.incrementFailedLogins(created.id)));
      expect([...counts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      expect(await db.users.incrementFailedLogins(newId())).toBe(0);
    });

    it('accepts each one-time code step once and recovery codes once', async () => {
      const created = await user();
      const twoFactor = { enabled: true, secret: 'enc', lastUsedStep: 10, recoveryCodes: ['a', 'b'] };
      await db.users.update(created.id, { twoFactor: { ...twoFactor, enabledAt: new Date() } });

      expect(await db.users.advanceTotpStep(created.id, 10)).toBe(false);
      expect(await db.users.advanceTotpStep(created.id, 9)).toBe(false);
      const parallel = await Promise.all([11, 11, 11].map((step) => db.users.advanceTotpStep(created.id, step)));
      expect(parallel.filter(Boolean)).toHaveLength(1);

      const used = await Promise.all(['a', 'a'].map((code) => db.users.useRecoveryCode(created.id, code)));
      expect(used.filter(Boolean)).toHaveLength(1);
      const found = await db.users.findById(created.id);
      expect(found.twoFactor).toMatchObject({ enabled: true, secret: 'enc', lastUsedStep: 11, recoveryCodes: ['b'] });
      expect(found.twoFactor.enabledAt).toBeInstanceOf(Date);
    });

    it('lists with role filter, literal search, sorting and paging', async () => {
      await user({ name: 'Alpha', email: 'alpha@example.com', role: 'admin' });
      await user({ name: 'Beta 100%', email: 'beta@example.com' });
      await user({ name: 'Gamma_x', email: 'gamma@example.com' });

      const admins = await db.users.list({ role: 'admin' });
      expect(admins.results.map((u) => u.name)).toEqual(['Alpha']);
      expect(admins.total).toBe(1);

      // % and _ match themselves, not "anything".
      expect((await db.users.list({ search: '100%' })).results.map((u) => u.name)).toEqual(['Beta 100%']);
      expect((await db.users.list({ search: 'a_x' })).results.map((u) => u.name)).toEqual(['Gamma_x']);
      expect((await db.users.list({ search: '_' })).total).toBe(1);
      expect((await db.users.list({ search: 'GAMMA@' })).total).toBe(1);
      expect((await db.users.list({ search: '.*' })).total).toBe(0);

      const page = await db.users.list({}, { sortBy: 'name', descending: false, offset: 1, limit: 1 });
      expect(page.results.map((u) => u.name)).toEqual(['Beta 100%']);
      expect(page.total).toBe(3);
      expect(page.results[0].password).toBe('scrypt$hash');
      expect(await db.users.count()).toBe(3);
    });

    it('removes an account', async () => {
      const created = await user();
      expect(await db.users.remove(created.id)).toBe(true);
      expect(await db.users.findById(created.id)).toBeNull();
    });
  });

  describe('tokens', () => {
    const token = (userId, overrides = {}) =>
      db.tokens.create({
        id: newId(),
        tokenHash: newId(),
        userId,
        type: 'refresh',
        expires: new Date(Date.now() + HOUR),
        ...overrides,
      });

    it('stores optional fields and finds by every filter', async () => {
      const owner = await user();
      const startedAt = new Date(Date.now() - 1000);
      const created = await token(owner.id, { family: 'f1', device: 'Firefox', startedAt, email: 'new@example.com' });
      const found = await db.tokens.find({ tokenHash: created.tokenHash, type: 'refresh', userId: owner.id });
      expect(found).toMatchObject({ id: created.id, userId: owner.id, family: 'f1', device: 'Firefox' });
      expect(found.email).toBe('new@example.com');
      expect(found.startedAt.getTime()).toBe(startedAt.getTime());
      expect(found.expires).toBeInstanceOf(Date);
      expect(await db.tokens.exists({ family: 'f1' })).toBe(true);
      expect(await db.tokens.exists({ family: 'f2' })).toBe(false);
    });

    it('ignores expired tokens when asked for valid ones', async () => {
      const owner = await user();
      const expired = await token(owner.id, { expires: new Date(Date.now() - 1000) });
      expect(await db.tokens.find({ tokenHash: expired.tokenHash, validAt: new Date() })).toBeNull();
      expect(await db.tokens.find({ tokenHash: expired.tokenHash })).not.toBeNull();
    });

    it('hands out a token only once, also to parallel callers', async () => {
      const owner = await user();
      const created = await token(owner.id);
      const taken = await Promise.all([1, 2, 3].map(() => db.tokens.take({ tokenHash: created.tokenHash })));
      expect(taken.filter(Boolean)).toHaveLength(1);
      expect(await db.tokens.take({ tokenHash: created.tokenHash })).toBeNull();
    });

    it('lists newest first, counts and removes', async () => {
      const owner = await user();
      const other = await user();
      const first = await token(owner.id);
      const second = await token(owner.id);
      await token(other.id, { type: 'resetPassword' });
      const listed = await db.tokens.list({ userId: owner.id });
      expect(listed.map((t) => t.id).sort()).toEqual([first.id, second.id].sort());
      expect(await db.tokens.count({ userId: owner.id })).toBe(2);
      expect(await db.tokens.count()).toBe(3);
      expect(await db.tokens.remove({ userId: owner.id })).toBe(2);
      expect(await db.tokens.count({ type: 'resetPassword' })).toBe(1);
    });
  });

  describe('audit', () => {
    it('keeps events per account, newest first', async () => {
      const owner = await user();
      await db.audit.add({ id: newId(), userId: owner.id, type: 'login', device: 'Safari' });
      await db.audit.add({ id: newId(), userId: owner.id, type: 'passwordChanged' });
      const events = await db.audit.list(owner.id, 1);
      expect(events).toHaveLength(1);
      expect(events[0].createdAt).toBeInstanceOf(Date);
      expect((await db.audit.types(owner.id)).sort()).toEqual(['login', 'passwordChanged']);
      await db.audit.removeForUser(owner.id);
      expect(await db.audit.types(owner.id)).toEqual([]);
    });
  });

  describe('sessions', () => {
    it('stores, refreshes, expires and destroys sessions', async () => {
      const later = new Date(Date.now() + HOUR);
      await db.sessions.set('sid-1', 'payload-1', later);
      expect(await db.sessions.get('sid-1', new Date())).toBe('payload-1');
      await db.sessions.set('sid-1', 'payload-2', later);
      expect(await db.sessions.get('sid-1', new Date())).toBe('payload-2');

      await db.sessions.touch('sid-1', new Date(Date.now() - 1000));
      expect(await db.sessions.get('sid-1', new Date())).toBeNull();

      await db.sessions.set('sid-2', 'payload', later);
      await db.sessions.destroy('sid-2');
      expect(await db.sessions.get('sid-2', new Date())).toBeNull();
    });

    it('keeps the last write when the same new session is saved in parallel', async () => {
      const later = new Date(Date.now() + HOUR);
      await Promise.all(['a', 'b', 'c'].map((data) => db.sessions.set('race', data, later)));
      expect(['a', 'b', 'c']).toContain(await db.sessions.get('race', new Date()));
    });
  });

  describe('rate limits', () => {
    it('counts in a window, starts a new one after it and never goes below zero', async () => {
      const now = new Date();
      expect((await db.rateLimits.increment('k', 1000, now)).hits).toBe(1);
      const second = await db.rateLimits.increment('k', 1000, now);
      expect(second.hits).toBe(2);
      expect(second.expiresAt.getTime()).toBe(now.getTime() + 1000);

      const after = new Date(now.getTime() + 2000);
      expect((await db.rateLimits.increment('k', 1000, after)).hits).toBe(1);

      await db.rateLimits.decrement('k');
      await db.rateLimits.decrement('k');
      expect((await db.rateLimits.increment('k', 1000, after)).hits).toBe(1);

      await db.rateLimits.reset('k');
      expect((await db.rateLimits.increment('k', 1000, after)).hits).toBe(1);
    });

    it('loses no hit when a new key is counted in parallel', async () => {
      const now = new Date();
      await Promise.all(Array.from({ length: 10 }, () => db.rateLimits.increment('burst', 60000, now)));
      expect((await db.rateLimits.increment('burst', 60000, now)).hits).toBe(11);
    });
  });

  describe('purge', () => {
    it('removes expired data and old activity, keeps the rest', async () => {
      const owner = await user();
      const past = new Date(Date.now() - 1000);
      await db.tokens.create({ id: newId(), tokenHash: 'old', userId: owner.id, type: 'refresh', expires: past });
      await db.tokens.create({
        id: newId(),
        tokenHash: 'new',
        userId: owner.id,
        type: 'refresh',
        expires: new Date(Date.now() + HOUR),
      });
      await db.sessions.set('old', 'x', past);
      await db.rateLimits.increment('old', 1, past);
      await db.audit.add({ id: newId(), userId: owner.id, type: 'login' });

      await db.purgeExpired(new Date(), new Date(Date.now() - HOUR));
      expect(await db.tokens.exists({ tokenHash: 'new' })).toBe(true);
      expect(await db.audit.types(owner.id)).toEqual(['login']);
      if (db.kind === 'sql') {
        // MongoDB leaves this to its TTL indexes, which run once a minute.
        expect(await db.tokens.exists({ tokenHash: 'old' })).toBe(false);
        await db.purgeExpired(new Date(), new Date(Date.now() + HOUR));
        expect(await db.audit.types(owner.id)).toEqual([]);
      }
    });
  });

  describe('owned records', () => {
    it('keeps every record inside its owner', async () => {
      const notes = db.owned('contract_notes');
      const alice = newId();
      const bob = newId();
      if (db.kind === 'sql') {
        await db.knex.schema.createTable('contract_notes', (table) => {
          table.string('id', 24).primary();
          table.string('owner_id', 24).notNullable();
          table.string('title', 200).notNullable();
          table.bigInteger('created_at').notNullable();
          table.bigInteger('updated_at').notNullable();
        });
      }
      try {
        const first = await notes.create(alice, { id: newId(), title: 'first' });
        await notes.create(alice, { id: newId(), title: 'second' });
        await notes.create(bob, { id: newId(), title: 'bob' });
        expect(first).toMatchObject({ title: 'first' });
        expect(first.createdAt).toBeInstanceOf(Date);
        expect(first).not.toHaveProperty('owner');
        expect(first).not.toHaveProperty('ownerId');

        expect(await notes.find(bob, first.id)).toBeNull();
        expect(await notes.update(bob, first.id, { title: 'stolen' })).toBeNull();
        expect(await notes.remove(bob, first.id)).toBe(false);

        const page = await notes.list(alice, { sortBy: 'title', descending: false, limit: 1 });
        expect(page.results.map((n) => n.title)).toEqual(['first']);
        expect(page.total).toBe(2);
        expect((await notes.list(alice)).results).toHaveLength(2);

        expect((await notes.update(alice, first.id, { title: 'renamed' })).title).toBe('renamed');
        expect(await notes.remove(alice, first.id)).toBe(true);
        await notes.removeAllOf(alice);
        expect((await notes.list(alice)).total).toBe(0);
        expect((await notes.list(bob)).total).toBe(1);
      } finally {
        await db.clear();
        if (db.kind === 'sql') await db.knex.schema.dropTable('contract_notes');
      }
    });
  });
});

describe.each(targets.slice(0, 3))('%s after disconnecting', (label, urlFor) => {
  it('reports the database as unreachable instead of throwing', async () => {
    const db = createDatabase({ url: await urlFor(), name: 'contract_closed', auditRetentionDays: 30 });
    await db.connect();
    await db.disconnect();
    expect(await db.ping()).toBe(false);
  });
});
