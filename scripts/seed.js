// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * Fills a development database with demo accounts: one admin, one user and enough extra accounts to page through
 * the admin list. Refuses to run in production. All accounts share one password, printed once at the end.
 *
 *   npm run seed                 random password
 *   SEED_PASSWORD=... npm run seed
 */
const crypto = require('node:crypto');

const DEMO_DOMAIN = 'example.com';
const EXTRA_NAMES = [
  'Ada Brandt',
  'Ben Okafor',
  'Clara Jung',
  'David Petrov',
  'Elif Kaya',
  'Finn Larsen',
  'Greta Novak',
  'Hugo Martin',
  'Ines Costa',
  'Jonas Weber',
  'Kira Sato',
  'Leon Fischer',
  'Mila Horvat',
  'Noah Schmid',
  'Olga Ivanova',
  'Paul Wagner',
  'Quinn Murphy',
  'Rosa Alvarez',
  'Sami Haddad',
  'Tara Singh',
  'Uwe Krüger',
  'Vera Lindqvist',
  'Willem de Vries',
  'Yara Nasser',
  'Zoe Baumann',
];

const slug = (name) =>
  name
    .normalize('NFKD')
    .replaceAll(/[^A-Za-z ]/g, '')
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '.');

// Creates the accounts that do not exist yet; running it twice changes nothing.
const seed = async ({ password, extraUsers = EXTRA_NAMES.length } = {}) => {
  const userService = require('../src/services/user.service');
  const accounts = [
    { name: 'Demo Admin', email: `admin@${DEMO_DOMAIN}`, role: 'admin' },
    { name: 'Demo User', email: `user@${DEMO_DOMAIN}`, role: 'user' },
    ...EXTRA_NAMES.slice(0, extraUsers).map((name) => ({ name, email: `${slug(name)}@${DEMO_DOMAIN}`, role: 'user' })),
  ];
  const results = await Promise.all(
    accounts.map(async (account) => {
      if (await userService.isEmailTaken(account.email)) return 0;
      await userService.createUser({ ...account, password, isEmailVerified: true });
      return 1;
    })
  );
  const created = results.reduce((sum, value) => sum + value, 0);
  return { created, total: accounts.length, accounts };
};

const main = async () => {
  const config = require('../src/config/config');
  if (config.env === 'production') {
    throw new Error('Refusing to seed a production database.');
  }
  const db = require('../src/db');
  const password = process.env.SEED_PASSWORD || `Demo-${crypto.randomBytes(9).toString('base64url')}`;
  await db.connect();
  try {
    const { created, total } = await seed({ password });
    process.stdout.write(`${created} of ${total} demo accounts created (admin@${DEMO_DOMAIN}, user@${DEMO_DOMAIN}).\n`);
    if (created > 0) {
      process.stdout.write(`Password for the new accounts: ${password}\n`);
    }
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

module.exports = { seed, DEMO_DOMAIN };
