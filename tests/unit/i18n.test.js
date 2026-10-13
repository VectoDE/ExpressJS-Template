// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const i18n = require('../../src/i18n');
const de = require('../../src/locales/de');
const en = require('../../src/locales/en');

// Every key with its placeholders, e.g. "flash.signedIn {name}".
const shape = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      return shape(value, path);
    }
    const placeholders = [...String(value).matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1])
      .sort((a, b) => a.localeCompare(b));
    return [`${path} ${placeholders.join(',')}`];
  });

describe('i18n', () => {
  it('has the same keys and placeholders in every language', () => {
    expect(shape(en).sort((a, b) => a.localeCompare(b))).toEqual(shape(de).sort((a, b) => a.localeCompare(b)));
  });

  it('translates with placeholders and falls back to the key for unknown ones', () => {
    expect(i18n.translate('de', 'flash.signedIn', { name: 'Ada' })).toBe('Willkommen zurück, Ada.');
    expect(i18n.translate('en', 'flash.signedIn', { name: 'Ada' })).toBe('Welcome back, Ada.');
    expect(i18n.translate('en', 'flash.signedIn')).toBe('Welcome back, {name}.');
    expect(i18n.translate('en', 'does.not.exist')).toBe('does.not.exist');
    expect(i18n.translate('fr', 'nav.signIn')).toBe('Sign in');
  });

  it('does not walk into prototype properties', () => {
    expect(i18n.translate('en', 'constructor')).toBe('constructor');
    expect(i18n.translate('en', '__proto__.toString')).toBe('__proto__.toString');
  });

  it.each([
    ['en-US,en;q=0.9,de;q=0.8', 'en'],
    ['de-DE,de;q=0.9,en;q=0.8', 'de'],
    ['fr-FR,fr;q=0.9,en;q=0.5,de;q=0.7', 'de'],
    ['en;q=0,de', 'de'],
    ['fr', null],
    ['', null],
    [undefined, null],
    ['x'.repeat(600), null],
  ])('negotiates %p to %p', (header, expected) => {
    expect(i18n.negotiate(header)).toBe(expected);
  });
});
