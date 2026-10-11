const { expect } = require('@playwright/test');
const { default: AxeBuilder } = require('@axe-core/playwright');
const fixtures = require('./fixtures');

let counter = 0;

// Unique per worker and call, so parallel tests never share an account.
const uniqueEmail = (prefix = 'e2e') => {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}@example.com`;
};

// Waits until the browser has left the sign-in page, otherwise a following goto can cancel the sign-in.
// A sign-in that is meant to fail returns right after the click; the test then waits for the error message.
const signIn = async (page, email, password = fixtures.password, { fails = false } = {}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('main form').getByRole('button', { name: 'Sign in' }).click();
  if (!fails) {
    await page.waitForURL((url) => url.pathname !== '/login');
  }
};

const register = async (page, { name = 'Jane Doe', email = uniqueEmail(), password = fixtures.password } = {}) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('main form').getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { name, email, password };
};

// On phones the button sits in the folded menu, so open it first.
const signOut = async (page) => {
  const toggle = page.locator('[data-menu-toggle]');
  if (await toggle.isVisible()) {
    // Right after a redirect the click can land before main.js has bound the toggle; repeat until it opens.
    await expect(async () => {
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click();
      }
      await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
    }).toPass();
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
};

// Collects browser errors; CSP violations and failed scripts show up here as well.
// WebKit on Linux styles native <select> menus with an internal stylesheet and then reports it as blocked by
// style-src 'self'. The message points at the <select> tag, not at anything the app ships, so only that one
// browser/platform pair ignores it.
const isWebKitSelectNoise = (page, message) =>
  process.platform === 'linux' &&
  page.context().browser()?.browserType().name() === 'webkit' &&
  message.text().startsWith('Refused to apply a stylesheet because its hash, its nonce');

const watchConsole = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 404/.test(message.text()) && !isWebKitSelectNoise(page, message)) {
      errors.push(message.text());
    }
  });
  return errors;
};

const expectAccessible = async (page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

// How many pixels the page is wider than the window; 0 means no sideways scrolling.
const horizontalOverflow = (page) =>
  page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));

module.exports = { uniqueEmail, signIn, signOut, register, watchConsole, expectAccessible, horizontalOverflow };
