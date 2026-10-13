// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

// Fixed test accounts for the browser tests. They only ever exist in the in-memory database of scripts/e2e-server.js.
module.exports = {
  port: Number(process.env.E2E_PORT) || 3100,
  password: 'E2e-Test-Password-2025',
  admin: 'admin@example.com',
  user: 'user@example.com',
};
