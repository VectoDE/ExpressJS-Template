const User = require('../../src/models/user.model');
const tokenService = require('../../src/services/token.service');

const PASSWORD = 'Correct-Horse-9-Battery';

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
