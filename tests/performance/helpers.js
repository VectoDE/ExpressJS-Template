/**
 * Test data for the load test. Must be required after the environment (secrets, MONGODB_URI) is set,
 * because tokens are signed with the same configuration the server uses.
 */
const os = require('node:os');
const mongoose = require('mongoose');
const User = require('../../src/models/user.model');
const tokenService = require('../../src/services/token.service');
const { hashPassword } = require('../../src/utils/password');

const PASSWORD = 'Load-Test-Password-2025';
// Plays the TLS proxy, so the server sets its Secure session cookie.
const PROXY = { 'x-forwarded-proto': 'https' };

const cookieFrom = (res) =>
  res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

const csrfFrom = (html) => {
  const match = /name="_csrf" value="([^"]+)"/.exec(html);
  if (!match) {
    throw new Error('No CSRF token in page');
  }
  return match[1];
};

// Runs fn(0..count-1) in batches of `size`, one batch after the other.
const inBatches = async (count, size, fn, start = 0) => {
  if (start >= count) {
    return [];
  }
  const batch = await Promise.all(Array.from({ length: Math.min(size, count - start) }, (_, j) => fn(start + j)));
  return [...batch, ...(await inBatches(count, size, fn, start + size))];
};

const createHelpers = async (base) => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME, runtimeAdapters: { os } });
  const passwordHash = await hashPassword(PASSWORD);
  let counter = 0;

  // One precomputed hash for all seeded users keeps preparation fast; logins still run the full scrypt check.
  const createUsers = async (count, role = 'user') => {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000 - 2000);
    const docs = Array.from({ length: count }, () => {
      counter += 1;
      return {
        name: `Perf User ${counter}`,
        email: `perf-${process.pid}-${counter}@example.com`,
        password: passwordHash,
        role,
        credentialsChangedAt: now,
      };
    });
    const inserted = await User.insertMany(docs);
    return inserted.map((doc) => ({ id: doc.id, email: doc.email, doc }));
  };

  const signedIn = async (role) => {
    const [user] = await createUsers(1, role);
    const tokens = await tokenService.generateAuthTokens(user.doc);
    return { user, token: tokens.access.token };
  };

  const signedInMany = async (count) => {
    const users = await createUsers(count);
    return Promise.all(
      users.map(async (user) => ({ user, token: (await tokenService.generateAuthTokens(user.doc)).access.token }))
    );
  };

  const refreshTokens = async (count) => {
    const users = await createUsers(Math.ceil(count / 10));
    return inBatches(count, 50, async (i) => {
      const tokens = await tokenService.generateAuthTokens(users[i % users.length].doc);
      return tokens.refresh.token;
    });
  };

  const webGuest = async (pagePath) => {
    const res = await fetch(`${base}${pagePath}`, { headers: { ...PROXY, accept: 'text/html' } });
    return { cookie: cookieFrom(res), csrf: csrfFrom(await res.text()) };
  };

  const webGuests = (count, pagePath) => inBatches(count, 10, () => webGuest(pagePath));

  // A signed-in browser session with a CSRF token taken from the dashboard forms.
  const webSessionFor = async (user) => {
    const guest = await webGuest('/login');
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { ...PROXY, 'content-type': 'application/x-www-form-urlencoded', cookie: guest.cookie },
      body: new URLSearchParams({ email: user.email, password: PASSWORD, _csrf: guest.csrf }).toString(),
    });
    if (res.status !== 302 || res.headers.get('location') !== '/dashboard') {
      throw new Error(`Web login failed with ${res.status}`);
    }
    const cookie = cookieFrom(res);
    const dashboard = await fetch(`${base}/dashboard`, { headers: { ...PROXY, cookie, accept: 'text/html' } });
    return { cookie, csrf: csrfFrom(await dashboard.text()), email: user.email };
  };

  const webSession = async () => webSessionFor((await createUsers(1))[0]);

  const webSessions = async (count) => {
    const users = await createUsers(count);
    return inBatches(count, 4, (i) => webSessionFor(users[i]));
  };

  const close = () => mongoose.disconnect();

  return {
    PASSWORD,
    createUsers,
    signedIn,
    signedInMany,
    refreshTokens,
    webGuests,
    webSession,
    webSessions,
    close,
  };
};

module.exports = { createHelpers };
