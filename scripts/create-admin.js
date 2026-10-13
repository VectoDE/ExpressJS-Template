// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * Creates an administrator account, or promotes an existing account to administrator.
 * Asks for name, email and password on the terminal; the password is not echoed.
 *
 *   npm run create-admin
 *   ADMIN_NAME=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin   (non-interactive, e.g. in CI)
 *   npm run create-admin -- --force                                          (promote an unverified account)
 *
 * An existing account is only promoted when its email address is verified. Otherwise anyone who registered with
 * an address they do not own could end up as administrator through a mix-up.
 */
const readline = require('node:readline');

const ask = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the prompt once, then swallow every echoed keystroke.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });

/**
 * Promotes the account with this email, or creates a new administrator when there is none.
 * Returns what happened: 'already', 'promoted' or 'created'. `askPassword` is only called for a new account.
 */
const createOrPromote = async ({ name, email, force = false, askPassword }) => {
  const Joi = require('joi');
  const { fields } = require('../src/validations/custom.validation');
  const userService = require('../src/services/user.service');

  const address = String(email).trim().toLowerCase();
  if (Joi.string().email().validate(address).error) {
    throw new Error('That is not a valid email address.');
  }
  const existing = await userService.getUserByEmail(address);
  if (existing) {
    if (existing.role === 'admin') {
      return 'already';
    }
    if (!existing.isEmailVerified && !force) {
      throw new Error(
        `${address} has not verified its email address, so it is not promoted. Verify the address first, ` +
          'or run "npm run create-admin -- --force" if you are sure the account belongs to the right person.'
      );
    }
    // A role change moves credentialsChangedAt, which ends the sessions of this account.
    await userService.saveChanges(existing, { role: 'admin' });
    return 'promoted';
  }
  if (fields.name().validate(name).error) {
    throw new Error('The name must be 3 to 120 characters long.');
  }
  const password = await askPassword();
  const { error: passwordError } = fields.newPassword().required().validate(password);
  if (passwordError) {
    throw new Error(passwordError.message);
  }
  await userService.createUser({ name, email: address, password, role: 'admin', isEmailVerified: true });
  return 'created';
};

const MESSAGES = {
  already: (email) => `${email} is already an administrator.`,
  promoted: (email) => `${email} is now an administrator. Existing sessions of this account were ended.`,
  created: (email) => `Administrator ${email} created. Sign in at /login.`,
};

const main = async () => {
  const db = require('../src/db');
  const force = process.argv.includes('--force');
  const name = process.env.ADMIN_NAME || (await ask('Name: '));
  const email = (process.env.ADMIN_EMAIL || (await ask('Email: '))).toLowerCase();
  await db.connect();
  try {
    const result = await createOrPromote({
      name,
      email,
      force,
      askPassword: async () =>
        process.env.ADMIN_PASSWORD || ask('Password (12+ characters, mixed): ', { hidden: true }),
    });
    process.stdout.write(`${MESSAGES[result](email)}\n`);
  } finally {
    await db.disconnect();
  }
};

if (require.main?.filename === __filename) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { createOrPromote };
