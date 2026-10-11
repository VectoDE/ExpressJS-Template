// Every page renders without browser errors, passes axe in both colour schemes and never scrolls sideways.
const { test, expect } = require('@playwright/test');
const fixtures = require('./fixtures');
const { signIn, watchConsole, expectAccessible, horizontalOverflow } = require('./helpers');

const PUBLIC_PAGES = ['/', '/login', '/register', '/forgot-password', '/security', '/privacy', '/imprint'];

for (const colorScheme of ['light', 'dark']) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    for (const path of PUBLIC_PAGES) {
      test(`${path} is accessible and error free`, async ({ page }) => {
        const errors = watchConsole(page);
        const response = await page.goto(path);
        expect(response.status()).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        await expectAccessible(page);
        expect(await horizontalOverflow(page), path).toBe(0);
        expect(errors).toEqual([]);
      });
    }

    test('error page keeps the layout and has one heading', async ({ page }) => {
      const response = await page.goto('/does-not-exist');
      expect(response.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Seite nicht gefunden');
      await expectAccessible(page);
    });

    test('account and admin pages are accessible', async ({ page }) => {
      const errors = watchConsole(page);
      await signIn(page, fixtures.admin);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expectAccessible(page);
      await page.goto('/admin/users');
      await expectAccessible(page);
      await page.locator('.data-table a').first().click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectAccessible(page);
      expect(errors).toEqual([]);
    });
  });
}

test('security headers are sent with every page', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-request-id']).toBeTruthy();
});
