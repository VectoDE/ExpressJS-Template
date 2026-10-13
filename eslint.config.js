// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { defineConfig } = require('eslint/config');
const js = require('@eslint/js');
const globals = require('globals');
const pluginSecurity = require('eslint-plugin-security');
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = defineConfig([
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'reports/',
      'playwright-report/',
      'test-results/',
      '.impeccable/',
      'preview-dist/',
    ],
  },
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  // The rules SonarQube applies to JavaScript ("Sonar way"), so issues show up before the code reaches a scanner.
  sonarjs.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-console': 'error',
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      // Reviewed: every dynamic key comes from a fixed allow-list, and sanitize() strips
      // __proto__/constructor/prototype from request bodies. The rule only reports false positives here.
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['src/public/**/*.js', 'scripts/preview/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  // MongoDB shell scripts run inside mongosh, which provides `db`.
  { files: ['docker/mongo/**/*.js'], languageOptions: { sourceType: 'script', globals: { db: 'readonly' } } },
  {
    // Command-line tools: they print results and read files whose paths come from package-lock.json.
    files: ['scripts/**/*.js', 'tests/performance/**/*.js'],
    rules: { 'no-console': 'off', 'security/detect-non-literal-fs-filename': 'off' },
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-require': 'off',
      // SonarQube runs these hotspot rules on main code only; tests (sonar.tests) use made-up passwords and IPs.
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
    },
  },
  // Browser tests: callbacks passed to page.evaluate() run in the page, where window and document exist.
  { files: ['tests/e2e/**/*.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
]);
