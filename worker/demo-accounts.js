// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Accounts of the public demo on Cloudflare Workers. The passwords are published on purpose (README, home page
 * banner): they were generated for the demo, protect nothing and are not used anywhere else. The build hashes
 * them (scripts/build-worker.js); the hourly reset restores exactly these accounts.
 */
/* eslint-disable sonarjs/no-hardcoded-passwords -- public demo credentials, documented in the README */
const DEMO_ACCOUNTS = [
  {
    id: '6a0de0000000000000000a01',
    name: 'Demo Admin',
    email: 'admin@demo.example.com',
    password: 'hepfAyQ-rjAEyDc-8Aa', // gitleaks:allow (public demo password)
    role: 'admin',
    locale: 'en',
  },
  {
    id: '6a0de0000000000000000a02',
    name: 'Demo User',
    email: 'user@demo.example.com',
    password: 'QmMYbUy-4GtUfHj-1Aa', // gitleaks:allow (public demo password)
    role: 'user',
    locale: 'de',
  },
];
/* eslint-enable sonarjs/no-hardcoded-passwords */

module.exports = { DEMO_ACCOUNTS };
