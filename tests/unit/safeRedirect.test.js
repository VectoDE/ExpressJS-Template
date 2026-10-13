// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const safeRedirect = require('../../src/utils/safeRedirect');

describe('safeRedirect', () => {
  it.each(['/', '/dashboard', '/privacy', '/login/2fa', '/admin/users', '/admin/users/0123456789abcdef01234567'])(
    'keeps the known page %s',
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    }
  );

  it('keeps only the query parameters the page uses', () => {
    expect(safeRedirect('/admin/users?q=ann&role=admin&page=2&evil=1')).toBe('/admin/users?q=ann&role=admin&page=2');
    expect(safeRedirect('/reset-password?token=abc&next=//evil.example')).toBe('/reset-password?token=abc');
    expect(safeRedirect('/dashboard?tab=1')).toBe('/dashboard');
    expect(safeRedirect('/admin/users?q=')).toBe('/admin/users');
  });

  it('drops query parameters from admin user pages', () => {
    expect(safeRedirect('/admin/users/0123456789abcdef01234567?x=1')).toBe('/admin/users/0123456789abcdef01234567');
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
    '/a/b',
    '/account/export',
    '/admin/users/not-an-id',
    '/admin/users/0123456789abcdef01234567/extra',
    '/DASHBOARD',
    '',
    undefined,
    { path: '/' },
    `/${'a'.repeat(3000)}`,
  ])('falls back for %p', (target) => {
    expect(safeRedirect(target, '/home')).toBe('/home');
  });
});
