const express = require('express');
const request = require('supertest');
const app = require('../../src/app');
const { useDatabase } = require('../helpers/db');
const { browser } = require('../helpers/web');

useDatabase();

describe('security headers', () => {
  it.each(['/', '/v1/users/profile', '/health', '/does-not-exist'])('are set on %s', async (path) => {
    const res = await request(app).get(path);
    const h = res.headers;
    expect(h['x-powered-by']).toBeUndefined();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['content-security-policy']).not.toMatch(/unsafe-(inline|eval)/);
    expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['cross-origin-embedder-policy']).toBe('require-corp');
    expect(h['cross-origin-resource-policy']).toBe('same-origin');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['cache-control']).toBe('no-store');
  });

  it('lets static assets be cached but never lists directories', async () => {
    const css = await request(app).get('/assets/css/components.css').expect(200);
    expect(css.headers['cache-control']).not.toBe('no-store');
    await request(app).get('/assets/').expect(404);
    await request(app).get('/assets/../app.js').expect(404);
  });
});

describe('CORS', () => {
  it('allows only configured origins and never with credentials', async () => {
    const allowed = await request(app)
      .options('/v1/auth/login')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();

    const denied = await request(app)
      .options('/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('is not enabled for the browser UI', async () => {
    const res = await request(app).get('/').set('Origin', 'https://app.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request limits and parsing', () => {
  it('rejects JSON bodies over 100 kB with 413', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(120 * 1024) }))
      .expect(413);
    expect(res.body.code).toBe(413);
  });

  it('answers malformed JSON with 400 and no parser internals', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at /);
  });

  it('ignores prototype pollution attempts', async () => {
    await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":"a@example.com","password":"x","__proto__":{"polluted":true}}');
    expect({}.polluted).toBeUndefined();
  });

  it('does not parse nested query objects', async () => {
    const res = await request(app).get('/v1/users?role[$ne]=admin');
    expect(res.status).toBe(401);
  });
});

describe('health and docs', () => {
  it('reports liveness without internal details', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('reports readiness from the database connection', async () => {
    const res = await request(app).get('/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('serves the OpenAPI document with the package version', async () => {
    const res = await request(app).get('/docs/openapi.json').expect(200);
    expect(res.body.info.version).toBe(require('../../package.json').version);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/auth/logout',
        '/auth/refresh-tokens',
        '/users',
        '/users/profile',
        '/users/{userId}',
      ])
    );
  });

  it('serves Swagger UI with its own, narrower exception for inline styles', async () => {
    const res = await request(app).get('/docs/').expect(200);
    expect(res.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");
    expect(res.headers['content-security-policy']).not.toContain('unsafe-eval');
  });
});

describe('rate limiting', () => {
  // A fresh app whose sign-in endpoints allow two counted requests per IP.
  const appWithLowLimit = () => {
    let limitedApp;
    const saved = process.env.AUTH_RATE_LIMIT_MAX;
    process.env.AUTH_RATE_LIMIT_MAX = '2';
    jest.isolateModules(() => {
      limitedApp = require('../../src/app');
    });
    process.env.AUTH_RATE_LIMIT_MAX = saved;
    return limitedApp;
  };

  it('blocks repeated failed sign-ins per IP with 429', async () => {
    const limitedApp = appWithLowLimit();
    await request(limitedApp).post('/v1/auth/login').send({}).expect(400);
    await request(limitedApp).post('/v1/auth/login').send({}).expect(400);
    const res = await request(limitedApp).post('/v1/auth/login').send({}).expect(429);
    expect(res.headers.ratelimit).toBeDefined();
    expect(res.body.code).toBe(429);
  });

  it('counts failed browser sign-ins although they answer with a redirect', async () => {
    const client = browser(appWithLowLimit());
    // Fails validation, so the test needs no database in the separately loaded app.
    const wrong = { email: 'not-an-email', password: 'x' };
    expect((await client.submit('/login', wrong)).status).toBe(302);
    expect((await client.submit('/login', wrong)).status).toBe(302);
    expect((await client.submit('/login', wrong)).status).toBe(429);
  });

  it('counts every request to endpoints that send email, also successful ones', async () => {
    let limiters;
    const saved = process.env.AUTH_RATE_LIMIT_MAX;
    process.env.AUTH_RATE_LIMIT_MAX = '2';
    jest.isolateModules(() => {
      limiters = require('../../src/middlewares/rateLimit');
    });
    process.env.AUTH_RATE_LIMIT_MAX = saved;
    const mailApp = express();
    mailApp.post('/send', limiters.emailLimiter, (req, res) => res.status(204).end());
    mailApp.use((error, req, res, _next) => res.status(error.statusCode).end());

    expect((await request(mailApp).post('/send')).status).toBe(204);
    expect((await request(mailApp).post('/send')).status).toBe(204);
    expect((await request(mailApp).post('/send')).status).toBe(429);
  });
});
