const safeRedirect = require('../../src/utils/safeRedirect');

describe('safeRedirect', () => {
  it.each(['/dashboard', '/dashboard?tab=1', '/a/b'])('keeps local path %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    String.raw`/\evil.example`,
    String.raw`\\evil.example`,
    'javascript:alert(1)',
    '/ /evil',
    '/..//evil.example',
    '/.//evil.example',
    '/%2e%2e//evil.example',
    '/a/..//evil.example',
    '',
    undefined,
    { path: '/' },
    `/${'a'.repeat(3000)}`,
  ])('falls back for %p', (target) => {
    expect(safeRedirect(target, '/home')).toBe('/home');
  });
});
