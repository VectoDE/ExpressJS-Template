// Layout from small phones to 4K TVs: no sideways scrolling, menu behaviour, scaling on large screens.
const { test, expect } = require('@playwright/test');
const fixtures = require('./fixtures');
const { signIn, horizontalOverflow } = require('./helpers');

const VIEWPORTS = [
  { name: 'phone', width: 320, height: 640 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'full hd', width: 1920, height: 1080 },
  { name: '4k tv', width: 3840, height: 2160 },
];

// Every test sets its viewport itself, so the phone project leaves this file out (playwright.config.js).
test.use({ reducedMotion: 'reduce' });

for (const viewport of VIEWPORTS) {
  test(`${viewport.name} (${viewport.width}px) never scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const path of ['/', '/login', '/register', '/security', '/privacy']) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBe(0);
    }
    await signIn(page, fixtures.admin);
    for (const path of ['/dashboard', '/admin/users']) {
      await page.goto(path);
      expect(await horizontalOverflow(page), path).toBe(0);
    }
  });
}

test('the menu folds behind a button on small screens and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const toggle = page.locator('[data-menu-toggle]');
  await expect(toggle).toBeVisible();
  await expect(page.locator('#site-menu').getByRole('link', { name: 'Security' })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#site-menu').getByRole('link', { name: 'Security' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('large screens scale the interface up', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('/');
  const rootSize = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
  expect(rootSize).toBeGreaterThanOrEqual(28);
});

test('admin table turns into cards on phones', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, fixtures.admin);
  await page.goto('/admin/users');
  await expect(page.locator('.data-table thead')).toBeHidden();
  await expect(page.locator('.data-table td').first()).toHaveCSS('display', 'grid');
});
