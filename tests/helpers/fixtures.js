const crypto = require('node:crypto');
const db = require('../../src/db');
const userService = require('../../src/services/user.service');
const tokenService = require('../../src/services/token.service');

// Generated per run, so no password literal lives in the code; prefix and suffix meet the password rules.
const PASSWORD = `Test-${crypto.randomBytes(9).toString('base64url')}-9a`;

let counter = 0;
// Accounts are created through the service like real sign-ups; fields a sign-up cannot set are written afterwards.
const createUser = async ({ lockUntil, ...overrides } = {}) => {
  counter += 1;
  const user = await userService.createUser({
    name: `Test User ${counter}`,
    email: `user${counter}@example.com`,
    password: PASSWORD,
    role: 'user',
    ...overrides,
  });
  if (lockUntil) {
    await db.users.update(user.id, { lockUntil });
    return db.users.findById(user.id);
  }
  return user;
};

const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

const tokensFor = (user) => tokenService.generateAuthTokens(user);

const bearer = (tokens) => ({ Authorization: `Bearer ${tokens.access.token}` });

module.exports = { PASSWORD, createUser, createAdmin, tokensFor, bearer };
