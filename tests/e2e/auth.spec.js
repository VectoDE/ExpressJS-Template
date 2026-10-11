// Sign-up, sign-in, two-factor and sign-out as a visitor would do it.
const { test, expect } = require('@playwright/test');
const totp = require('../../src/utils/totp');
const fixtures = require('./fixtures');
const { register, signIn, signOut, uniqueEmail } = require('./helpers');

test.use({ reducedMotion: 'reduce' });

test('a visitor registers, lands in the account and signs out', async ({ page }) => {
  const { name } = await register(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
  await signOut(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('a wrong password shows an error and keeps the email', async ({ page }) => {
  const email = uniqueEmail();
  await register(page, { email });
  await signOut(page);
  await signIn(page, email, 'Wrong-Password-123!', { fails: true });
  await expect(page.locator('.flash--error')).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveValue(email);
});

test('two-factor: set up with the app, then sign in with a code', async ({ page }) => {
  const { email } = await register(page);
  await page.locator('#setup-password').fill(fixtures.password);
  await page.getByRole('button', { name: 'Start setup' }).click();

  const secret = (await page.locator('.totp-secret code').textContent()).replace(/\s/g, '');
  await page.locator('#enable-code').fill(totp.generate(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.locator('.recovery-codes li')).toHaveCount(10);

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/login\/2fa$/);
  // The code of the next 30-second window: the current one was used for the setup and is refused as a replay.
  await page.getByLabel('Code').fill(totp.generate(secret, Date.now() + 30000));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a sent form marks its button as busy', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(uniqueEmail());
  await page.getByLabel('Password', { exact: true }).fill('Wrong-Password-123!');
  // Runs after the page's own submit handler, records the button state and keeps the page from navigating away.
  await page.evaluate(() => {
    document.addEventListener('submit', (event) => {
      window.busyState = event.submitter.getAttribute('aria-busy');
      event.preventDefault();
    });
  });
  await page.locator('main form').getByRole('button', { name: 'Sign in' }).click();
  expect(await page.evaluate(() => window.busyState)).toBe('true');
});
