const { MongoMemoryServer } = require('mongodb-memory-server');
const { createDatabase } = require('../../src/db');
const { newId } = require('../../src/utils/id');
const { copyDatabase } = require('../../scripts/copy-database');

const HOUR = 60 * 60 * 1000;
const open = (url, name = 'copy_test') => createDatabase({ url, name, auditRetentionDays: 30 });

let mongod;
let sqlite;
let mongo;
let back;

beforeAll(async () => {
  const configured = process.env.DATABASE_URL;
  if (!configured.startsWith('mongodb')) mongod = await MongoMemoryServer.create();
  sqlite = open('sqlite::memory:');
  mongo = open(mongod ? mongod.getUri() : configured, `copy_${process.env.JEST_WORKER_ID}`);
  // In the CI database jobs the copy back goes into the server under test.
  const sqlServer = !configured.startsWith('mongodb') && !configured.startsWith('sqlite');
  back = open(sqlServer ? configured : 'sqlite::memory:');
  await Promise.all([sqlite.connect(), mongo.connect(), back.connect()]);
});

afterAll(async () => {
  await Promise.all([mongo.drop(), back.drop()]);
  await Promise.all([sqlite.disconnect(), mongo.disconnect(), back.disconnect()]);
  await mongod?.stop();
});

// Everything a user record carries, including the fields that are hidden from enumeration.
const snapshot = (user) => ({
  ...user,
  password: user.password,
  twoFactor: user.twoFactor,
  failedLoginAttempts: user.failedLoginAttempts,
  lockUntil: user.lockUntil,
});

describe('npm run copy-database', () => {
  it('copies accounts, second factors, activity and valid tokens from SQL to MongoDB and back', async () => {
    const id = newId();
    await sqlite.users.create({
      id,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'scrypt$131072$hash',
      role: 'admin',
      isEmailVerified: true,
      locale: 'de',
    });
    const enabledAt = new Date(Date.now() - HOUR);
    await sqlite.users.update(id, {
      twoFactor: { enabled: true, secret: 'encrypted', lastUsedStep: 42, recoveryCodes: ['h1', 'h2'], enabledAt },
      failedLoginAttempts: 2,
      lockUntil: new Date(Date.now() + HOUR),
    });
    await sqlite.audit.add({ id: newId(), userId: id, type: 'login', device: 'Firefox' });
    await sqlite.passkeys.create({
      id: newId(),
      userId: id,
      credentialId: 'Y3JlZGVudGlhbA',
      publicKey: 'cHVibGljIGtleQ',
      counter: 7,
      transports: ['usb', 'nfc'],
      name: 'Security key',
      lastUsedAt: new Date(Date.now() - HOUR),
    });
    await sqlite.audit.add({ id: newId(), userId: id, type: 'twoFactorEnabled' });
    const valid = { id: newId(), tokenHash: 'valid', userId: id, type: 'refresh', family: 'f', device: 'Firefox' };
    await sqlite.tokens.create({ ...valid, expires: new Date(Date.now() + HOUR), startedAt: new Date() });
    await sqlite.tokens.create({
      id: newId(),
      tokenHash: 'expired',
      userId: id,
      type: 'refresh',
      expires: new Date(Date.now() - 1000),
    });
    const original = snapshot(await sqlite.users.findById(id));

    expect(await copyDatabase(sqlite, mongo)).toEqual({ users: 1, tokens: 1 });
    expect(snapshot(await mongo.users.findById(id))).toEqual(original);
    const passkeys = await sqlite.passkeys.listForUser(id);
    expect(await mongo.passkeys.listForUser(id)).toEqual(passkeys);
    expect((await mongo.audit.types(id)).sort()).toEqual(['login', 'twoFactorEnabled']);
    expect(await mongo.tokens.find({ tokenHash: 'valid' })).toMatchObject({ id: valid.id, userId: id, family: 'f' });
    expect(await mongo.tokens.exists({ tokenHash: 'expired' })).toBe(false);

    expect(await copyDatabase(mongo, back)).toEqual({ users: 1, tokens: 1 });
    expect(snapshot(await back.users.findById(id))).toEqual(original);
    expect(await back.passkeys.listForUser(id)).toEqual(passkeys);
    const events = await back.audit.list(id, 10);
    expect(events.map((event) => event.type).sort()).toEqual(['login', 'twoFactorEnabled']);
    expect(events.find((event) => event.type === 'login').device).toBe('Firefox');
  });

  it('copies more accounts than fit on one page', async () => {
    const source = open('sqlite::memory:');
    const target = open('sqlite::memory:');
    await Promise.all([source.connect(), target.connect()]);
    try {
      await Promise.all(
        Array.from({ length: 501 }, (unused, index) =>
          source.users.create({
            id: newId(),
            name: `User ${index}`,
            email: `user${index}@example.com`,
            password: 'x',
            role: 'user',
            isEmailVerified: false,
            locale: 'en',
          })
        )
      );
      expect((await copyDatabase(source, target)).users).toBe(501);
      expect(await target.users.count()).toBe(501);
    } finally {
      await Promise.all([source.disconnect(), target.disconnect()]);
    }
  });

  it('refuses a target that already has accounts', async () => {
    await expect(copyDatabase(sqlite, mongo)).rejects.toThrow('empty database');
  });
});
