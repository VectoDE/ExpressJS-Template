// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Stands in for database drivers the Worker cannot load (native addons, raw TCP drivers): better-sqlite3, sqlite3,
 * pg, mysql, mysql2, tedious, oracledb and mongodb. The demo only talks to D1, so nothing here is ever called;
 * if something does, it fails loudly instead of half working.
 */
const fail = () => {
  throw new Error('This database driver is not available in the Cloudflare Worker build; use DATABASE_URL=d1:DB');
};

class Unavailable {
  constructor() {
    fail();
  }
}

module.exports = new Proxy(fail, {
  get: (target, property) => {
    if (property === '__esModule') return false;
    if (property === 'default') return module.exports;
    return Unavailable;
  },
});
