// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * Builds a static copy of the web pages for GitHub Pages: every public page, the account dashboard and the user
 * administration in English and German, rendered by the real app against an in-memory SQLite database with the
 * demo accounts. Forms cannot work without the server; scripts/preview/preview.js stops them and says so.
 *
 *   npm run build:preview                    writes preview-dist/ for https://<owner>.github.io/ExpressJS-Template/
 *   PREVIEW_BASE=/ npm run build:preview     for a preview served from the root of a domain
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('../tests/e2e/fixtures');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'preview-dist');
const BASE = (process.env.PREVIEW_BASE || '/ExpressJS-Template/').replace(/\/?$/, '/');
const LOCALES = ['en', 'de'];
const DEFAULT_LOCALE = 'en';

const GUEST_PAGES = ['/', '/security', '/privacy', '/imprint', '/login', '/register', '/forgot-password'];
const ADMIN_PAGES = ['/dashboard', '/admin/users'];

// A tiny cookie jar: the app only needs the session cookie between requests.
const client = (base) => {
  const cookies = new Map();
  const request = async (pathname, { method = 'GET', form, locale } = {}) => {
    const headers = { 'accept-language': locale || DEFAULT_LOCALE };
    if (cookies.size) headers.cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
    const response = await fetch(new URL(pathname, base), {
      method,
      headers,
      body: form ? new URLSearchParams(form).toString() : undefined,
      redirect: 'manual',
    });
    response.headers.getSetCookie().forEach((line) => {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    });
    return response;
  };
  return { request };
};

const csrfFrom = (html) => /name="_csrf" value="([^"]+)"/.exec(html)?.[1];

const signIn = async (session, email) => {
  const form = await (await session.request('/login')).text();
  const response = await session.request('/login', {
    method: 'POST',
    form: { _csrf: csrfFrom(form), email, password: fixtures.password },
  });
  if (response.status !== 302 || response.headers.get('location') !== '/dashboard') {
    throw new Error(`Sign-in as ${email} failed with ${response.status}`);
  }
};

// Where a page of the app ends up in the static copy: /security in German becomes <base>de/security/.
const target = (pathname, locale) => {
  const segments = pathname
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((segment) => `${segment}/`);
  const prefix = locale === DEFAULT_LOCALE ? '' : `${locale}/`;
  return BASE + prefix + segments.join('');
};

/**
 * Points every link at the static copy. Assets keep their path under the base, pages get their folder in the
 * current language, and the language switch leads to the same page in the other language.
 */
const rewrite = (html, locale, exported) =>
  html
    .replaceAll(/(href|src|action)="\/(?!\/)([^"]*)"/g, (match, attribute, rest) => {
      const pathname = `/${rest}`.replaceAll('&amp;', '&');
      if (pathname.startsWith('/assets/')) {
        return `${attribute}="${BASE}${rest}"`;
      }
      const language = /^\/language\/([a-z]{2})\?returnTo=([^&]*)/.exec(pathname);
      if (language) {
        return `${attribute}="${target(decodeURIComponent(language[2]), language[1])}"`;
      }
      const page = pathname.split('?')[0];
      if (attribute === 'action' || !exported.has(page)) {
        // Forms and pages that need the server stay on the current page; preview.js explains why.
        return attribute === 'action'
          ? `${attribute}="#"`
          : `${attribute}="${target(page, locale)}" data-preview-missing`;
      }
      return `${attribute}="${target(page, locale)}"`;
    })
    .replace('</head>', `<script src="${BASE}assets/js/preview.js" defer></script>\n</head>`);

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const save = (pathname, locale, html, exported) => {
  const folder = target(pathname, locale).slice(BASE.length);
  write(path.join(OUT, folder, 'index.html'), rewrite(html, locale, exported));
};

// Runs `step` for each item, one after the other.
const inSequence = (items, step) =>
  items.reduce((previous, item) => previous.then(() => step(item)), Promise.resolve());

const main = async () => {
  Object.assign(process.env, {
    NODE_ENV: 'development',
    DATABASE_URL: 'sqlite::memory:',
    JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
    SESSION_SECRET: crypto.randomBytes(48).toString('base64url'),
    ENCRYPTION_KEY: crypto.randomBytes(48).toString('base64url'),
    APP_URL: 'https://app.example.com',
    API_DOCS_ENABLED: 'false',
    LOG_LEVEL: 'error',
  });
  const db = require('../src/db');
  const { seed } = require('./seed');
  await db.connect();
  await seed({ password: fixtures.password });
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    fs.rmSync(OUT, { recursive: true, force: true });
    const admin = client(base);
    await signIn(admin, fixtures.admin);
    // Every demo account gets its detail page, so each link of the user list leads somewhere.
    const { results } = await db.users.list({}, { limit: 1000 });
    const userPages = results.map((account) => `/admin/users/${account.id}`);
    // Both pages only render with a valid link; the tokens live in the in-memory database of this run only.
    const tokenService = require('../src/services/token.service');
    const { tokenTypes } = require('../src/config/tokens');
    const member = await db.users.findByEmail(fixtures.user);
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    const linkFor = async (type) => encodeURIComponent(await tokenService.createEmailToken(member, type, inOneHour));
    const guestPages = [
      ...GUEST_PAGES,
      `/reset-password?token=${await linkFor(tokenTypes.RESET_PASSWORD)}`,
      `/verify-email?token=${await linkFor(tokenTypes.VERIFY_EMAIL)}`,
    ];
    const exported = new Set([...guestPages, ...ADMIN_PAGES, ...userPages].map((page) => page.split('?')[0]));

    // One page after the other: the clients carry session cookies, and the language switch must come first.
    const exportPage = async (as, page, locale) => {
      const response = await as.request(page, { locale });
      if (response.status !== 200) throw new Error(`${page} answered ${response.status}`);
      save(page, locale, await response.text(), exported);
    };
    const exportLocale = async (locale) => {
      const guest = client(base);
      await inSequence(guestPages, (page) => exportPage(guest, page, locale));
      // The missing page doubles as the 404 page of GitHub Pages (only the default language can be served).
      const missing = await guest.request('/this-page-does-not-exist', { locale });
      const notFound = rewrite(await missing.text(), locale, exported);
      write(path.join(OUT, locale === DEFAULT_LOCALE ? '404.html' : `${locale}/404.html`), notFound);

      // Switching the language leaves a confirmation for the next page; fetching that page once uses it up.
      await admin.request(`/language/${locale}?returnTo=%2Fdashboard`);
      await admin.request('/dashboard', { locale });
      await inSequence([...ADMIN_PAGES, ...userPages], (page) => exportPage(admin, page, locale));
    };
    await inSequence(LOCALES, exportLocale);

    fs.cpSync(path.join(ROOT, 'src/public'), path.join(OUT, 'assets'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'preview/preview.js'), path.join(OUT, 'assets/js/preview.js'));
    // GitHub Pages must serve the folders as they are, without Jekyll.
    write(path.join(OUT, '.nojekyll'), '');
    process.stdout.write(`Preview written to ${path.relative(ROOT, OUT)} for ${BASE}\n`);
  } finally {
    server.close();
    await db.disconnect();
  }
};

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
