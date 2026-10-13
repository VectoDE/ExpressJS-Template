// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

const { browser } = require('../helpers/web');

// The whole app with DEMO_MODE, as the Cloudflare Worker runs it, on its own in-memory database.
const loadDemoApp = () => {
  const saved = { ...process.env };
  Object.assign(process.env, { DEMO_MODE: 'true', PASSWORD_HASH_COST: '10', DATABASE_URL: 'sqlite::memory:' });
  try {
    let loaded;
    jest.isolateModules(() => {
      loaded = { app: require('../../src/app'), db: require('../../src/db') };
    });
    return loaded;
  } finally {
    process.env = saved;
  }
};

const PASSWORD = 'Demo-Test-2026!x';
const decode = (text) => text.replaceAll('&amp;', '&');
// Path and query of the first link in the page that goes to pathname with a token.
const linkTo = (html, pathname) => {
  const href = [...html.matchAll(/href="([^"]+)"/g)]
    .map((match) => new URL(decode(match[1]), 'https://demo.example.com'))
    .find((url) => url.pathname === pathname && url.searchParams.has('token'));
  return href ? `${href.pathname}${href.search}` : null;
};

describe('demo mode', () => {
  const { app, db } = loadDemoApp();

  beforeAll(() => db.connect());
  afterAll(async () => {
    await db.drop();
    await db.disconnect();
  });

  it('marks every page as a public demo', async () => {
    const { agent } = browser(app);
    const res = await agent.get('/').set('Accept-Language', 'de');
    expect(res.text).toContain('Öffentliche Demo');
  });

  it('shows the verification email after sign-up instead of sending it', async () => {
    const { agent, submit } = browser(app);
    const res = await submit('/register', {
      name: 'Demo Person',
      email: 'demo-person@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(302);
    const page = await agent.get(res.headers.location).set('Accept', 'text/html');
    expect(page.text).toContain('Email not sent');
    expect(linkTo(page.text, '/verify-email')).toMatch(/^\/verify-email\?token=/);
    // Shown once: the next page no longer has it.
    const again = await agent.get('/dashboard').set('Accept', 'text/html');
    expect(again.text).not.toContain('Email not sent');
  });

  it('waits for the reset email and shows its link on the next page', async () => {
    const { agent, submit } = browser(app);
    const res = await submit('/forgot-password', { email: 'demo-person@example.com' });
    expect(res.status).toBe(302);
    const page = await agent.get(res.headers.location).set('Accept', 'text/html');
    const link = linkTo(page.text, '/reset-password');
    expect(link).toMatch(/^\/reset-password\?token=/);
    const form = await agent.get(link).set('Accept', 'text/html');
    expect(form.status).toBe(200);
  });

  it('answers the API reset request only after the reset has been prepared', async () => {
    const { agent } = browser(app);
    const res = await agent.post('/v1/auth/forgot-password').send({ email: 'demo-person@example.com' });
    expect(res.status).toBe(204);
  });
});
