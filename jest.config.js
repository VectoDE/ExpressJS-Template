// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/tests/{unit,integration}/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageThreshold: {
    global: { statements: 90, branches: 80, functions: 90, lines: 90 },
  },
};
