// The motion layer: off for reduced motion, switchable in the footer, scroll-driven story on the home page.
const { test, expect } = require('@playwright/test');

test('reduced motion shows the final state without the motion class', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/motion/);
  await expect(page.locator('.feature').first()).toHaveCSS('opacity', '1');
});

test('the footer switch changes the style and remembers it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'film');
  const playful = page.getByRole('button', { name: 'Playful' });
  await playful.click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'playful');
  await expect(page.getByRole('button', { name: 'Playful' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Off' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('html')).not.toHaveClass(/motion/);
  await page.goto('/security');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
});

// Desktop only: touch scrolling takes the same code path.
test('the story follows the scroll position', { tag: '@desktop' }, async ({ page }) => {
  await page.goto('/');
  const story = page.locator('[data-story]');
  await page.locator('[data-step="0"]').scrollIntoViewIfNeeded();
  await page.locator('[data-step="6"]').evaluate((step) => step.scrollIntoView({ block: 'center' }));
  await expect(page.locator('[data-step="6"]')).toHaveClass(/is-active/);
  const progress = await story.evaluate((element) => Number(element.style.getPropertyValue('--story-progress')));
  expect(progress).toBeGreaterThan(0.9);
});

test('headlines are split into words but keep their text for screen readers', async ({ page }) => {
  await page.goto('/');
  const title = page.locator('.hero__title');
  await expect(title).toHaveClass(/is-split/);
  await expect(title).toHaveAttribute('aria-label', /Express\.js/);
  await expect(title.locator('.word').first()).toHaveAttribute('aria-hidden', 'true');
});
