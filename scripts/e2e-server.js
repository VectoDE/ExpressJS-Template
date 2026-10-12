/**
 * Starts the app against a throwaway in-memory SQLite database with demo accounts. Used by the Playwright tests and
 * handy for a quick look at the interface without installing a database. Nothing is written to disk.
 * Set PREVIEW_DATABASE_URL to run the same preview against another database.
 */
const crypto = require('node:crypto');
const fixtures = require('../tests/e2e/fixtures');

const start = async () => {
  Object.assign(process.env, {
    NODE_ENV: 'development',
    PORT: String(fixtures.port),
    DATABASE_URL: process.env.PREVIEW_DATABASE_URL || 'sqlite::memory:',
    DATABASE_NAME: 'e2e',
    JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
    SESSION_SECRET: crypto.randomBytes(48).toString('base64url'),
    ENCRYPTION_KEY: crypto.randomBytes(48).toString('base64url'),
    APP_URL: `http://localhost:${fixtures.port}`,
    API_DOCS_ENABLED: 'true',
    // Browser tests sign in many times in a row.
    AUTH_RATE_LIMIT_MAX: '1000',
    RATE_LIMIT_MAX: '100000',
    LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
  });
  const db = require('../src/db');
  const { seed } = require('./seed');
  await db.connect();
  await seed({ password: fixtures.password });
  // server.js connects again, which is a no-op on an open connection; the in-memory database stays.
  require('../src/server');
};

start().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
