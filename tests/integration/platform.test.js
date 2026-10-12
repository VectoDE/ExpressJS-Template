const request = require('supertest');
const app = require('../../src/app');
const config = require('../../src/config/config');
const { useDatabase, db } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { PASSWORD, createUser } = require('../helpers/fixtures');

useDatabase();

describe('languages', () => {
  it('follows Accept-Language without setting a cookie', async () => {
    const res = await request(app).get('/').set('Accept', 'text/html').set('Accept-Language', 'de-DE,de;q=0.9');
    expect(res.text).toContain('<html lang="de"');
    expect(res.text).toContain('Anmelden');
    expect(res.headers['set-cookie']).toBeUndefined();
    // Without a usable header the default language applies.
    const fallback = await request(app).get('/').set('Accept', 'text/html').set('Accept-Language', 'fr');
    expect(fallback.text).toContain('<html lang="en"');
  });

  it('switches with a link, returns to the page and remembers the choice', async () => {
    const client = browser(app);
    const res = await client.agent.get('/language/en?returnTo=%2Fsecurity').expect(302);
    expect(res.headers.location).toBe('/security');
    const page = await client.agent.get('/security').set('Accept', 'text/html');
    expect(page.text).toContain('<html lang="en"');
    expect(page.text).toContain('The language is now English.');
  });

  it('refuses unknown languages and foreign redirect targets', async () => {
    const client = browser(app);
    const unknown = await client.agent.get('/language/fr?returnTo=%2Fprivacy').expect(302);
    expect(unknown.headers.location).toBe('/privacy');
    const foreign = await client.agent.get('/language/en?returnTo=https%3A%2F%2Fevil.example').expect(302);
    expect(foreign.headers.location).toBe('/');
  });

  it('stores the language with the account, so emails use it too', async () => {
    const user = await createUser();
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });
    await client.agent.get('/language/en?returnTo=%2Fdashboard').expect(302);
    expect((await db.users.findById(user.id)).locale).toBe('en');
    const dashboard = await client.agent.get('/dashboard').set('Accept', 'text/html');
    expect(dashboard.text).toContain('Hello, ');
  });

  it('serves every page in both languages without missing texts', async () => {
    const user = await createUser({ role: 'admin' });
    for (const locale of ['de', 'en']) {
      const client = browser(app);
      await client.agent.get(`/language/${locale}`);
      await client.submit('/login', { email: user.email, password: PASSWORD });
      for (const path of [
        '/',
        '/security',
        '/privacy',
        '/imprint',
        '/dashboard',
        '/admin/users',
        `/admin/users/${user.id}`,
      ]) {
        const res = await client.agent.get(path).set('Accept', 'text/html').expect(200);
        expect(res.text).toContain(`<html lang="${locale}"`);
        // A missing key would show up as its dotted name.
        expect(res.text).not.toMatch(/>\s*(nav|common|account|admin|auth|fields|flash|activity)\.[a-zA-Z.]+\s*</);
      }
    }
  });
});

describe('request ids', () => {
  it('adds an id to every response and to error bodies', async () => {
    const res = await request(app).get('/v1/nope').expect(404);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('keeps a harmless incoming id and replaces anything else', async () => {
    const kept = await request(app).get('/health').set('X-Request-Id', 'edge-1234.abcd');
    expect(kept.headers['x-request-id']).toBe('edge-1234.abcd');
    const replaced = await request(app).get('/health').set('X-Request-Id', 'bad id <script>');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('GET /metrics', () => {
  afterEach(() => {
    config.metrics.token = '';
  });

  it('does not exist without METRICS_TOKEN', async () => {
    await request(app).get('/metrics').expect(404);
  });

  it('needs the bearer token and then returns Prometheus text', async () => {
    config.metrics.token = 'metrics-test-token-0123456789abcdef0123';
    const denied = await request(app).get('/metrics').set('Authorization', 'Bearer wrong').expect(401);
    expect(denied.headers['www-authenticate']).toBe('Bearer');
    await request(app).get('/health');
    const res = await request(app).get('/metrics').set('Authorization', `Bearer ${config.metrics.token}`).expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_requests_total{method="GET",route="/health",status="200"}');
  });
});
