/**
 * Every endpoint of the app with its expected status and latency budget (p99, milliseconds).
 * Endpoints that consume something (a refresh token, a session, an account) get one fresh item per request.
 *
 * Budgets: cheap reads 150 ms, database reads and writes 300 ms. Endpoints that verify or hash a password
 * run scrypt with 128 MiB per call on purpose, so they are measured with few connections and a 3 s budget.
 */
const SCRYPT = { connections: 4, p99: 3000 };
const POOL = 40;

const json = (body, headers = {}) => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
});
const form = (fields, cookie) => ({
  body: new URLSearchParams(fields).toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, 'sec-fetch-site': 'same-origin' },
});
const auth = (token) => ({ authorization: `Bearer ${token}` });
const take = (pool) => {
  const item = pool.shift();
  if (!item) {
    throw new Error('Pool exhausted');
  }
  return item;
};
let unique = 0;
const nextEmail = (prefix) => {
  unique += 1;
  return `${prefix}-${process.pid}-${unique}@example.com`;
};

const page = (name, path, p99 = 150) => ({
  name: `web:${name}`,
  method: 'GET',
  path: () => path,
  expect: 200,
  p99,
});

const endpoints = (h) => [
  // Infrastructure and static files
  { name: 'health:live', method: 'GET', path: () => '/health', expect: 200, p99: 100 },
  { name: 'health:ready', method: 'GET', path: () => '/health/ready', expect: 200, p99: 100 },
  { name: 'static:css', method: 'GET', path: () => '/assets/css/components.css', expect: 200, p99: 100 },
  { name: 'static:js', method: 'GET', path: () => '/assets/js/main.js', expect: 200, p99: 100 },
  { name: 'static:favicon', method: 'GET', path: () => '/assets/img/favicon.svg', expect: 200, p99: 100 },
  { name: 'docs:openapi', method: 'GET', path: () => '/docs/openapi.json', expect: 200, p99: 150 },
  { name: 'docs:ui', method: 'GET', path: () => '/docs/', expect: 200, p99: 150 },
  { name: 'notfound:api', method: 'GET', path: () => '/v1/unknown', expect: 404, p99: 150 },

  // Public pages
  page('home', '/'),
  page('security', '/security'),
  page('privacy', '/privacy'),
  page('imprint', '/imprint'),
  page('login-form', '/login'),
  page('register-form', '/register'),

  // API: authentication
  {
    name: 'auth:register',
    method: 'POST',
    path: () => '/v1/auth/register',
    label: '/v1/auth/register',
    expect: 201,
    ...SCRYPT,
    amount: () => POOL,
    request: () => json({ name: 'Load Test', email: nextEmail('reg'), password: h.PASSWORD }),
  },
  {
    name: 'auth:login',
    method: 'POST',
    path: () => '/v1/auth/login',
    expect: 200,
    ...SCRYPT,
    prepare: async () => ({ user: (await h.createUsers(1))[0] }),
    request: (ctx) => json({ email: ctx.user.email, password: h.PASSWORD }),
  },
  {
    name: 'auth:login-wrong-password',
    method: 'POST',
    path: () => '/v1/auth/login',
    expect: 401,
    ...SCRYPT,
    prepare: async () => ({ user: (await h.createUsers(1))[0] }),
    request: (ctx) => json({ email: ctx.user.email, password: 'Wrong-Password-123' }),
  },
  {
    name: 'auth:refresh-tokens',
    method: 'POST',
    path: () => '/v1/auth/refresh-tokens',
    expect: 200,
    p99: 300,
    amount: () => POOL * 5,
    prepare: async () => ({ pool: await h.refreshTokens(POOL * 5) }),
    request: (ctx) => json({ refreshToken: take(ctx.pool) }),
  },
  {
    name: 'auth:logout',
    method: 'POST',
    path: () => '/v1/auth/logout',
    expect: 204,
    p99: 300,
    amount: () => POOL * 5,
    prepare: async () => ({ pool: await h.refreshTokens(POOL * 5) }),
    request: (ctx) => json({ refreshToken: take(ctx.pool) }),
  },

  // API: own account
  {
    name: 'users:profile',
    method: 'GET',
    path: () => '/v1/users/profile',
    expect: 200,
    p99: 300,
    prepare: () => h.signedIn('user'),
    request: (ctx) => ({ headers: auth(ctx.token) }),
  },
  {
    name: 'account:export',
    method: 'GET',
    path: () => '/v1/account/export',
    expect: 200,
    p99: 300,
    prepare: () => h.signedIn('user'),
    request: (ctx) => ({ headers: auth(ctx.token) }),
  },
  {
    name: 'account:update-name',
    method: 'PATCH',
    path: () => '/v1/account',
    expect: 200,
    p99: 300,
    prepare: () => h.signedIn('user'),
    request: (ctx) => json({ name: `Name ${Date.now()}` }, auth(ctx.token)),
  },
  {
    name: 'account:delete',
    method: 'DELETE',
    path: () => '/v1/account',
    expect: 204,
    ...SCRYPT,
    amount: () => POOL,
    prepare: async () => ({ pool: await h.signedInMany(POOL) }),
    request: (ctx) => json({ password: h.PASSWORD }, auth(take(ctx.pool).token)),
  },

  // API: administration
  {
    name: 'users:list',
    method: 'GET',
    path: () => '/v1/users?limit=20&sortBy=createdAt:desc',
    expect: 200,
    p99: 300,
    prepare: () => h.signedIn('admin'),
    request: (ctx) => ({ headers: auth(ctx.token) }),
  },
  {
    name: 'users:get',
    method: 'GET',
    path: (ctx) => `/v1/users/${ctx.label ? ':userId' : ctx.target.id}`,
    expect: 200,
    p99: 300,
    prepare: async () => ({ ...(await h.signedIn('admin')), target: (await h.createUsers(1))[0] }),
    request: (ctx) => ({ headers: auth(ctx.token) }),
  },
  {
    name: 'users:update',
    method: 'PATCH',
    path: (ctx) => `/v1/users/${ctx.label ? ':userId' : ctx.target.id}`,
    expect: 200,
    p99: 300,
    prepare: async () => ({ ...(await h.signedIn('admin')), target: (await h.createUsers(1))[0] }),
    request: (ctx) => json({ name: `Renamed ${Date.now()}` }, auth(ctx.token)),
  },
  {
    name: 'users:create',
    method: 'POST',
    path: () => '/v1/users',
    expect: 201,
    ...SCRYPT,
    amount: () => POOL,
    prepare: () => h.signedIn('admin'),
    request: (ctx) => json({ name: 'Created', email: nextEmail('adm'), password: h.PASSWORD }, auth(ctx.token)),
  },
  {
    name: 'users:delete',
    method: 'DELETE',
    path: () => '/v1/users/:userId',
    label: '/v1/users/:userId',
    expect: 204,
    p99: 300,
    amount: () => POOL * 5,
    prepare: async () => ({ ...(await h.signedIn('admin')), pool: await h.createUsers(POOL * 5) }),
    // The id differs per request, so the path is rewritten in setupRequest.
    request: (ctx) => ({ path: `/v1/users/${take(ctx.pool).id}`, headers: auth(ctx.token) }),
  },

  // Browser: signed-in pages and forms
  {
    name: 'web:dashboard',
    method: 'GET',
    path: () => '/dashboard',
    expect: 200,
    p99: 300,
    prepare: async () => h.webSession(),
    request: (ctx) => ({ headers: { cookie: ctx.cookie } }),
  },
  {
    name: 'web:account-export',
    method: 'GET',
    path: () => '/account/export',
    expect: 200,
    p99: 300,
    prepare: async () => h.webSession(),
    request: (ctx) => ({ headers: { cookie: ctx.cookie } }),
  },
  {
    name: 'web:login',
    method: 'POST',
    path: () => '/login',
    expect: 302,
    ...SCRYPT,
    amount: () => POOL,
    prepare: async () => ({ user: (await h.createUsers(1))[0], pool: await h.webGuests(POOL, '/login') }),
    request: (ctx) => {
      const guest = take(ctx.pool);
      return form({ email: ctx.user.email, password: h.PASSWORD, _csrf: guest.csrf }, guest.cookie);
    },
  },
  {
    name: 'web:register',
    method: 'POST',
    path: () => '/register',
    expect: 302,
    ...SCRYPT,
    amount: () => POOL,
    prepare: async () => ({ pool: await h.webGuests(POOL, '/register') }),
    request: (ctx) => {
      const guest = take(ctx.pool);
      return form({ name: 'Web User', email: nextEmail('web'), password: h.PASSWORD, _csrf: guest.csrf }, guest.cookie);
    },
  },
  {
    name: 'web:logout',
    method: 'POST',
    path: () => '/logout',
    expect: 302,
    p99: 300,
    amount: () => POOL,
    prepare: async () => ({ pool: await h.webSessions(POOL) }),
    request: (ctx) => {
      const session = take(ctx.pool);
      return form({ _csrf: session.csrf }, session.cookie);
    },
  },
  {
    // A saved profile starts a fresh session, so every request needs its own.
    name: 'web:account-profile',
    method: 'POST',
    path: () => '/account/profile',
    expect: 302,
    p99: 300,
    amount: () => POOL,
    prepare: async () => ({ pool: await h.webSessions(POOL) }),
    request: (ctx) => {
      const session = take(ctx.pool);
      return form({ name: 'Renamed Web User', email: session.email, _csrf: session.csrf }, session.cookie);
    },
  },
  {
    name: 'web:account-password',
    method: 'POST',
    path: () => '/account/password',
    expect: 302,
    ...SCRYPT,
    amount: () => POOL,
    prepare: async () => ({ pool: await h.webSessions(POOL) }),
    request: (ctx) => {
      const session = take(ctx.pool);
      const next = `${h.PASSWORD}-2`;
      return form(
        { currentPassword: h.PASSWORD, password: next, passwordConfirm: next, _csrf: session.csrf },
        session.cookie
      );
    },
  },
  {
    name: 'web:account-delete',
    method: 'POST',
    path: () => '/account/delete',
    expect: 302,
    ...SCRYPT,
    amount: () => POOL,
    prepare: async () => ({ pool: await h.webSessions(POOL) }),
    request: (ctx) => {
      const session = take(ctx.pool);
      return form({ password: h.PASSWORD, _csrf: session.csrf }, session.cookie);
    },
  },
  {
    name: 'web:notfound',
    method: 'GET',
    path: () => '/missing-page',
    expect: 404,
    p99: 150,
    request: () => ({ headers: { accept: 'text/html' } }),
  },
];

module.exports = endpoints;
