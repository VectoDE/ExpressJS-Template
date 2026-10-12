// Passkeys end to end: the page script, the browser's WebAuthn API and the server verification together.
// WebAuthn needs an authenticator, and Chromium offers a virtual one through the DevTools protocol, so
// playwright.config.js runs this file only in the Chromium-based projects.
const { test, expect } = require('@playwright/test');
const totp = require('../../src/utils/totp');
const fixtures = require('./fixtures');
const { register, signIn, signOut } = require('./helpers');

test.use({ reducedMotion: 'reduce' });

test('passkey: add one in the account, then sign in with it instead of a code', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  const { email } = await register(page);
  await page.locator('#setup-password').fill(fixtures.password);
  await page.getByRole('button', { name: 'Start setup' }).click();
  const secret = (await page.locator('.totp-secret code').textContent()).replace(/\s/g, '');
  await page.locator('#enable-code').fill(totp.generate(secret));
  await page.getByRole('button', { name: 'Turn on' }).click();
  await expect(page.locator('.recovery-codes li')).toHaveCount(10);

  await page.locator('#passkey-password').fill(fixtures.password);
  await page.getByRole('button', { name: 'Add passkey' }).click();
  await page.getByLabel('Name of the passkey').fill('Virtual key');
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await expect(page.locator('#passkeys')).toContainText('Virtual key');
  await expect(page.locator('#passkeys')).toContainText('Not used yet');

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/login\/2fa$/);
  await page.getByRole('button', { name: 'Use a passkey' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('#passkeys')).toContainText('Last used');
});
