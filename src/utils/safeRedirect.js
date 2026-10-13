// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const MAX_LENGTH = 2048;

// Pages a redirect may lead back to, with the query parameters each one keeps. The target is rebuilt from these
// constants, so user input can pick a known page but never decide where a redirect leads.
const PAGES = new Map(
  [
    ['/', []],
    ['/dashboard', []],
    ['/security', []],
    ['/privacy', []],
    ['/imprint', []],
    ['/login', []],
    ['/login/2fa', []],
    ['/register', []],
    ['/forgot-password', []],
    ['/reset-password', ['token']],
    ['/verify-email', ['token']],
    ['/admin/users', ['q', 'role', 'page']],
  ].map(([path, params]) => [path, { path, params }])
);

const USER_PAGE = /^\/admin\/users\/([a-f\d]{24})$/;

const withQuery = (path, params, search) => {
  const query = new URLSearchParams();
  params.forEach((name) => {
    const value = search.get(name);
    if (value) {
      query.set(name, value);
    }
  });
  const text = query.toString();
  return text ? `${path}?${text}` : path;
};

const parseLocal = (target) => {
  if (typeof target !== 'string' || target.length > MAX_LENGTH) {
    return null;
  }
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\s]/.test(target)) {
    return null;
  }
  try {
    const url = new URL(target, 'http://localhost');
    return url.origin === 'http://localhost' ? url : null;
  } catch {
    // Anything the URL parser rejects is treated like a foreign target.
    return null;
  }
};

/**
 * Returns a path on this site for `target`, or `fallback` when `target` is not one of the known pages.
 * Absolute URLs, protocol-relative URLs (`//evil.example`), backslash tricks and dot segments that normalise to
 * another page never get through, because only the pages listed above and an admin user page are accepted.
 */
const safeRedirect = (target, fallback = '/') => {
  const url = parseLocal(target);
  if (!url) {
    return fallback;
  }
  const page = PAGES.get(url.pathname);
  if (page) {
    return withQuery(page.path, page.params, url.searchParams);
  }
  const user = USER_PAGE.exec(url.pathname);
  return user ? `/admin/users/${user[1]}` : fallback;
};

module.exports = safeRedirect;
