const db = require('../../src/db');

const connect = () => db.connect();

const clear = () => db.clear();

const disconnect = async () => {
  await db.drop();
  await db.disconnect();
};

// Registers connect / clear / disconnect hooks for a test file.
const useDatabase = () => {
  beforeAll(connect);
  afterEach(clear);
  afterAll(disconnect);
};

// True when the account has an activity entry of this type.
const hasAuditEvent = async (userId, type) => (await db.audit.types(userId)).includes(type);

// Lets stored tokens of a type run out, as if their time had passed.
const expireTokens = async (type) => {
  const tokens = await db.tokens.list({ type });
  await db.tokens.remove({ type });
  await Promise.all(tokens.map((token) => db.tokens.create({ ...token, expires: new Date(Date.now() - 1000) })));
};

module.exports = { db, connect, clear, disconnect, useDatabase, hasAuditEvent, expireTokens };
