const crypto = require('node:crypto');
const User = require('../../src/models/user.model');
const tokenService = require('../../src/services/token.service');

// Generated per run, so no password literal lives in the code; prefix and suffix meet the password rules.
const PASSWORD = `Test-${crypto.randomBytes(9).toString('base64url')}-9a`;

let counter = 0;
const createUser = async (overrides = {}) => {
  counter += 1;
  return User.create({
    name: `Test User ${counter}`,
    email: `user${counter}@example.com`,
    password: PASSWORD,
    role: 'user',
    ...overrides,
  });
};

const createAdmin = (overrides = {}) => createUser({ role: 'admin', ...overrides });

const tokensFor = (user) => tokenService.generateAuthTokens(user);

const bearer = (tokens) => ({ Authorization: `Bearer ${tokens.access.token}` });

module.exports = { PASSWORD, createUser, createAdmin, tokensFor, bearer };
