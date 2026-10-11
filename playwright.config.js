// Browser tests: real pages in Chromium, Firefox and WebKit against an in-memory database (scripts/e2e-server.js).
const { defineConfig, devices } = require('@playwright/test');
const fixtures = require('./tests/e2e/fixtures');

const baseURL = `http://localhost:${fixtures.port}`;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    // The tests read German labels; the English texts are covered by the i18n unit tests.
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Tests tagged @desktop and the viewport tests, which set their own sizes, would only repeat the desktop runs.
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grepInvert: /@desktop/,
      testIgnore: '**/responsive.spec.js',
    },
  ],
  webServer: {
    command: 'node scripts/e2e-server.js',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
