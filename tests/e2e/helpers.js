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
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.locator('main form').getByRole('button', { name: 'Anmelden' }).click();
  if (!fails) {
    await page.waitForURL((url) => url.pathname !== '/login');
  }
};

const register = async (page, { name = 'Erika Muster', email = uniqueEmail(), password = fixtures.password } = {}) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.locator('main form').getByRole('button', { name: 'Registrieren' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { name, email, password };
};

// On phones the button sits in the folded menu, so open it first.
const signOut = async (page) => {
  const toggle = page.locator('[data-menu-toggle]');
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
};

// Collects browser errors; CSP violations and failed scripts show up here as well.
const watchConsole = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of 404/.test(message.text())) errors.push(message.text());
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
