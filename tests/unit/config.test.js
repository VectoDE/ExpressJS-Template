// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const crypto = require('crypto');

const loadConfig = (env) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    }
  });
  try {
    let config;
    jest.isolateModules(() => {
      config = require('../../src/config/config');
    });
    return config;
  } finally {
    process.env = saved;
  }
};

const strong = {
  NODE_ENV: 'production',
  JWT_SECRET: crypto.randomBytes(32).toString('base64url'),
  SESSION_SECRET: crypto.randomBytes(32).toString('base64url'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
  APP_URL: 'https://app.example.com',
  SMTP_URL: 'smtps://mailer:password@smtp.example.com:465',
  CORS_ORIGIN: 'https://app.example.com',
  TRUST_PROXY: '1',
  API_DOCS_ENABLED: undefined,
};

describe('config', () => {
  it('accepts a complete production setup with secure defaults', () => {
    const config = loadConfig(strong);
    expect(config.isProduction).toBe(true);
    expect(config.security.session.cookieSecure).toBe(true);
    expect(config.security.session.name).toBe('__Host-sid');
    expect(config.docsEnabled).toBe(false);
    expect(config.ephemeralSecrets).toEqual([]);
  });

  it.each([
    ['missing JWT secret', { JWT_SECRET: undefined }, /JWT_SECRET is required/],
    ['placeholder secret', { JWT_SECRET: 'change-me-change-me-change-me-change' }, /placeholder/],
    ['same secret twice', { SESSION_SECRET: strong.JWT_SECRET }, /must all be different/],
    ['wildcard CORS', { CORS_ORIGIN: '*' }, /CORS_ORIGIN=\*/],
    ['insecure cookies', { SESSION_COOKIE_SECURE: 'false' }, /SESSION_COOKIE_SECURE/],
    ['short secret', { JWT_SECRET: 'tooshort' }, /Environment validation error/],
    ['malformed origin', { CORS_ORIGIN: 'app.example.com/path' }, /must be an origin/],
    ['missing encryption key', { ENCRYPTION_KEY: undefined }, /ENCRYPTION_KEY is required/],
    ['encryption key reused', { ENCRYPTION_KEY: strong.SESSION_SECRET }, /must all be different/],
    ['missing APP_URL', { APP_URL: undefined }, /APP_URL is required/],
    ['APP_URL without https', { APP_URL: 'http://app.example.com' }, /APP_URL must use https/],
    ['missing SMTP_URL', { SMTP_URL: undefined }, /SMTP_URL is required/],
    ['no trusted proxy', { TRUST_PROXY: '0' }, /TRUST_PROXY is required/],
    ['placeholder metrics token', { METRICS_TOKEN: 'changeme-changeme-changeme-changeme' }, /METRICS_TOKEN/],
  ])('refuses to start in production with %s', (label, override, message) => {
    expect(() => loadConfig({ ...strong, ...override })).toThrow(message);
  });

  it('uses random per-process secrets in development instead of known defaults', () => {
    const unset = {
      NODE_ENV: 'development',
      JWT_SECRET: undefined,
      SESSION_SECRET: undefined,
      ENCRYPTION_KEY: undefined,
    };
    const a = loadConfig(unset);
    const b = loadConfig(unset);
    expect(a.ephemeralSecrets.sort((a, b) => a.localeCompare(b))).toEqual([
      'ENCRYPTION_KEY',
      'JWT_SECRET',
      'SESSION_SECRET',
    ]);
    expect(a.jwt.secret).not.toBe(b.jwt.secret);
    expect(a.jwt.secret.length).toBeGreaterThanOrEqual(64);
  });

  it('reads TRUST_PROXY as hop count or boolean', () => {
    expect(loadConfig({ TRUST_PROXY: 'true' }).security.trustProxy).toBe(1);
    expect(loadConfig({ TRUST_PROXY: '2' }).security.trustProxy).toBe(2);
    expect(loadConfig({ TRUST_PROXY: 'false' }).security.trustProxy).toBe(0);
  });
});
