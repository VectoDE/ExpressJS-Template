// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const userService = require('../../src/services/user.service');
const request = require('supertest');
const app = require('../../src/app');
const { useDatabase, db } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { PASSWORD, createUser } = require('../helpers/fixtures');

useDatabase();

const signIn = async (client, user) => client.submit('/login', { email: user.email, password: PASSWORD });

describe('public pages', () => {
  it.each(['/', '/security', '/privacy', '/login', '/register'])('renders %s as HTML', async (path) => {
    const res = await request(app).get(path).set('Accept', 'text/html').expect(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('<main');
  });

  it('does not set a session cookie on pages without a form', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('renders an HTML 404 for browsers and JSON for API clients', async () => {
    const html = await request(app).get('/nope').set('Accept', 'text/html').expect(404);
    expect(html.text).toContain('Page not found');
    const json = await request(app).get('/nope').set('Accept', 'application/json').expect(404);
    expect(json.body).toEqual({ code: 404, message: 'Not found', requestId: json.headers['x-request-id'] });
  });
});

describe('sign-in flow', () => {
  it('signs in, shows the dashboard without tokens and signs out', async () => {
    const user = await createUser();
    const client = browser(app);
    const res = await signIn(client, user);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const dashboard = await client.agent.get('/dashboard').expect(200);
    expect(dashboard.text).toContain(user.email);
    expect(dashboard.text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ/);

    const logout = await client.submit('/logout', {}, '/dashboard');
    expect(logout.headers.location).toBe('/?signedOut=1');
    expect(await client.agent.get('/dashboard')).toMatchObject({ status: 302, headers: { location: '/login' } });
  });

  it('issues a new session id at sign-in (no session fixation)', async () => {
    const user = await createUser();
    const client = browser(app);
    const before = (await client.agent.get('/login')).headers['set-cookie'][0].split(';')[0];
    const after = (await signIn(client, user)).headers['set-cookie'][0].split(';')[0];
    expect(after).not.toBe(before);
  });

  it('rejects wrong credentials with a generic message', async () => {
    const user = await createUser();
    const client = browser(app);
    const res = await client.submit('/login', { email: user.email, password: 'Wrong-Password-1' });
    expect(res.headers.location).toBe('/login');
    const page = await client.agent.get('/login');
    expect(page.text).toContain('Email address or password is incorrect.');
  });

  it('registers a regular user and ignores a smuggled role', async () => {
    const client = browser(app);
    const res = await client.submit('/register', {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'Compiler-Pioneer-1952',
      role: 'admin',
    });
    expect(res.headers.location).toBe('/dashboard');
    expect((await db.users.findByEmail('grace@example.com')).role).toBe('user');
  });

  it('shows validation errors and duplicate emails without detail', async () => {
    const existing = await createUser();
    const client = browser(app);
    const weak = await client.submit('/register', { name: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(weak.headers.location).toBe('/register');
    const dup = await client.submit('/register', {
      name: 'Dup',
      email: existing.email,
      password: 'Compiler-Pioneer-1952',
    });
    expect(dup.headers.location).toBe('/register');
    const bad = await client.submit('/login', { email: 'not-an-email', password: 'x' });
    expect(bad.headers.location).toBe('/login');
  });

  it('explains errors and keeps what was typed, except the password', async () => {
    const client = browser(app);
    await client.submit('/register', { name: 'Ada <b>', email: 'ada@example.com', password: 'short' });
    const page = (await client.agent.get('/register').set('Accept', 'text/html')).text;
    expect(page).toContain('The password needs 12 to 128 characters');
    expect(page).not.toContain('must be');
    expect(page).toContain('value="Ada &lt;b&gt;"');
    expect(page).toContain('value="ada@example.com"');
    expect(page).not.toContain('value="short"');

    // The kept input is shown once only.
    const again = (await client.agent.get('/register').set('Accept', 'text/html')).text;
    expect(again).not.toContain('value="ada@example.com"');
  });

  it('marks the current page in the navigation', async () => {
    const res = await request(app).get('/security').set('Accept', 'text/html').expect(200);
    expect(res.text).toMatch(/href="\/security" aria-current="page"/);
    expect(res.text).toContain('<title>Security · Express.js Template</title>');
    const home = await request(app).get('/').set('Accept', 'text/html').expect(200);
    expect(home.text).toContain('<title>Express.js Template</title>');
    expect(home.text).toContain('content-security-policy');
  });

  it('redirects back to the requested page, but never off-site', async () => {
    const user = await createUser();
    const client = browser(app);
    await client.agent.get('/dashboard').expect(302);
    const res = await signIn(client, user);
    expect(res.headers.location).toBe('/dashboard');
  });

  it.each(['//evil.example', '/..//evil.example', '/.//evil.example', 'https://evil.example'])(
    'never sends the language switch off-site (returnTo=%s)',
    async (target) => {
      const res = await request(app).get('/language/en').query({ returnTo: target });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
    }
  );

  it('sends signed-in users away from the guest pages', async () => {
    const user = await createUser();
    const client = browser(app);
    await signIn(client, user);
    expect(await client.agent.get('/login')).toMatchObject({ status: 302, headers: { location: '/dashboard' } });
  });
});

describe('session lifetime', () => {
  it('ends the session after a password change', async () => {
    const user = await createUser();
    const client = browser(app);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await signIn(client, user);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await userService.saveChanges(user, { password: 'Another-Password-77' });
    expect(await client.agent.get('/dashboard')).toMatchObject({ status: 302, headers: { location: '/login' } });
  });

  it('ends the session when the account is deleted', async () => {
    const user = await createUser();
    const client = browser(app);
    await signIn(client, user);
    await db.users.remove(user.id);
    expect(await client.agent.get('/dashboard')).toMatchObject({ status: 302, headers: { location: '/login' } });
  });
});

describe('CSRF protection', () => {
  it('rejects form posts without a token', async () => {
    const client = browser(app);
    await client.agent.get('/login');
    const res = await client.agent.post('/login').type('form').send({ email: 'a@example.com', password: 'x' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('rejects a token from another session', async () => {
    const victim = browser(app);
    const attacker = browser(app);
    const token = await attacker.csrfFrom('/login');
    await victim.agent.get('/login');
    const res = await victim.agent
      .post('/login')
      .type('form')
      .send({ email: 'a@example.com', password: 'x', _csrf: token });
    expect(res.headers.location).toBe('/login');
  });

  it('rejects cross-site requests by Fetch Metadata even with a valid token', async () => {
    const user = await createUser();
    const client = browser(app);
    const token = await client.csrfFrom('/login');
    const res = await client.agent
      .post('/login')
      .set('Sec-Fetch-Site', 'cross-site')
      .type('form')
      .send({ email: user.email, password: PASSWORD, _csrf: token });
    expect(res.headers.location).toBe('/login');
  });

  it('masks the token differently on every render (BREACH)', async () => {
    const client = browser(app);
    const first = await client.csrfFrom('/login');
    const second = await client.csrfFrom('/login');
    expect(first).not.toBe(second);
  });

  it.each(['garbage', 'a.b', `${'A'.repeat(43)}.${'B'.repeat(43)}`, 'x'.repeat(500)])(
    'rejects a malformed token %#',
    async (token) => {
      const client = browser(app);
      await client.agent.get('/login');
      const res = await client.agent
        .post('/login')
        .type('form')
        .send({ email: 'a@example.com', password: 'x', _csrf: token });
      expect(res.headers.location).toBe('/login');
    }
  );

  it('rejects posts without any session and never runs the action', async () => {
    const res = await request(app).post('/logout').type('form').send({}).set('Accept', 'text/html');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});
