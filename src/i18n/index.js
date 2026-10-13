// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const config = require('../config/config');
const en = require('../locales/en');
const de = require('../locales/de');

/**
 * Small translation layer without a library: nested dictionaries per locale, dotted keys,
 * {placeholder} substitution. A missing key falls back to the default locale, then to the key itself,
 * so a gap shows up as visible text instead of an exception. tests/unit/i18n.test.js keeps both files in sync.
 */
const dictionaries = new Map([
  ['en', en],
  ['de', de],
]);
const SUPPORTED = [...dictionaries.keys()];

const isSupported = (locale) => dictionaries.has(locale);

const lookup = (locale, key) =>
  key
    .split('.')
    .reduce((node, part) => (node && Object.hasOwn(node, part) ? node[part] : undefined), dictionaries.get(locale));

const translate = (locale, key, vars = {}) => {
  const value = lookup(locale, key) ?? lookup(config.defaultLocale, key);
  if (typeof value !== 'string') {
    return key;
  }
  return value.replaceAll(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
};

// Raw subtree, for templates that iterate over a group of texts (error pages, activity labels).
const section = (locale, key) => lookup(locale, key) ?? lookup(config.defaultLocale, key);

/**
 * Picks the best supported language from an Accept-Language header, honouring q-values.
 * "en-US,en;q=0.9,de;q=0.8" gives "en". Unknown or malformed headers give null.
 */
const negotiate = (header) => {
  if (typeof header !== 'string' || header.length > 512) {
    return null;
  }
  const candidates = header
    .split(',')
    .slice(0, 20)
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const weight = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const q = weight === undefined ? 1 : Number(weight.slice(2));
      return { language: tag.trim().toLowerCase().split('-')[0], q: q >= 0 && q <= 1 ? q : 0, index };
    })
    .filter((candidate) => candidate.q > 0 && isSupported(candidate.language))
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return candidates.length ? candidates[0].language : null;
};

const forLocale = (locale) => {
  const resolved = isSupported(locale) ? locale : config.defaultLocale;
  return {
    locale: resolved,
    t: (key, vars) => translate(resolved, key, vars),
    section: (key) => section(resolved, key),
  };
};

module.exports = { SUPPORTED, isSupported, translate, section, negotiate, forLocale };
