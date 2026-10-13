// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Data reset of the public demo, run by the Cron Trigger in wrangler.jsonc. Deletes every record and restores the
 * demo accounts with the password hashes made at build time (worker-dist/demo-seed.js), so the reset itself
 * needs no expensive hashing and stays within the CPU limit of a scheduled run.
 */
const userRecordOf = (account, at) => ({
  id: account.id,
  name: account.name,
  email: account.email,
  password: account.passwordHash,
  role: account.role,
  isEmailVerified: true,
  locale: account.locale,
  credentialsChangedAt: at,
  failedLoginAttempts: 0,
  lockUntil: null,
  twoFactor: {},
  createdAt: at,
  updatedAt: at,
});

const resetDemoData = async (db, accounts, now = new Date()) => {
  await db.clear();
  for (const account of accounts) {
    // One after the other: the demo has two accounts, and D1 handles sequential writes best.
    await db.users.restore(userRecordOf(account, now));
  }
};

module.exports = { resetDemoData, userRecordOf };
