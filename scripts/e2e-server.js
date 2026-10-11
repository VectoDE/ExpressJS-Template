/**
 * Starts the app against a throwaway in-memory MongoDB with demo accounts. Used by the Playwright tests and handy
 * for a quick look at the interface without installing MongoDB. Nothing is written to disk.
 */
const crypto = require('node:crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fixtures = require('../tests/e2e/fixtures');

const start = async () => {
  const mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    NODE_ENV: 'development',
    PORT: String(fixtures.port),
    MONGODB_URI: mongo.getUri(),
    MONGODB_DB_NAME: 'e2e',
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
  const mongoose = require('../src/config/mongoose');
  const { seed } = require('./seed');
  await mongoose.connect();
  await seed({ password: fixtures.password });
  process.on('exit', () => void mongo.stop());
  require('../src/server');
};

start().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
