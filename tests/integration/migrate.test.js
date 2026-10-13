// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../../src/db');

// A SQLite file stands in for a server where the app account has no right to change the schema.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-'));
const file = path.join(tmp, 'app.db').split(path.sep).join('/');
const url = `sqlite://${file.startsWith('/') ? '' : '/'}${file}`;
const open = (migrate) => createDatabase({ url, name: 'x', auditRetentionDays: 30, migrate });

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('separate migration account', () => {
  it('refuses to start on an outdated schema instead of changing it', async () => {
    const app = open(false);
    await expect(app.connect()).rejects.toThrow('npm run migrate');
    await app.disconnect();
  });

  it('npm run migrate applies the migrations with MIGRATION_DATABASE_URL, then the app starts', async () => {
    const output = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/migrate.js')], {
      env: { ...process.env, DATABASE_URL: 'sqlite::memory:', MIGRATION_DATABASE_URL: url },
      encoding: 'utf8',
    });
    expect(output).toContain('Applied: 001_initial');

    const again = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/migrate.js')], {
      env: { ...process.env, DATABASE_URL: url },
      encoding: 'utf8',
    });
    expect(again).toContain('up to date');

    const app = open(false);
    await app.connect();
    expect(await app.ping()).toBe(true);
    await app.disconnect();
  });
});
