// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const userService = require('../../src/services/user.service');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const config = require('../../src/config/config');
const tokenService = require('../../src/services/token.service');
const { useDatabase, db } = require('../helpers/db');
const { PASSWORD, createUser, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();

const register = (body) => request(app).post('/v1/auth/register').send(body);
const login = (email, password = PASSWORD) => request(app).post('/v1/auth/login').send({ email, password });

describe('POST /v1/auth/register', () => {
  const valid = { name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'Analytical-Engine-1843' };

  it('creates a regular user, normalises the email and never returns the hash', async () => {
    const res = await register(valid).expect(201);
    expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com', role: 'user' });
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('failedLoginAttempts');
    expect(res.body.tokens.access.token).toEqual(expect.any(String));
    const stored = await db.users.findByEmail('ada@example.com');
    expect(stored.password).toMatch(/^scrypt\$/);
  });

  it('rejects a role in the body, so nobody can sign up as admin', async () => {
    await register({ ...valid, role: 'admin' }).expect(400);
    expect(await db.users.count()).toBe(0);
  });

  it.each([
    ['too short', 'Short-1!'],
    ['no symbol', 'NoSymbolsHere123'],
    ['no upper case', 'all-lower-case-123'],
    ['too long', `Aa1!${'x'.repeat(130)}`],
  ])('rejects a weak password (%s)', async (label, password) => {
    await register({ ...valid, password }).expect(400);
  });

  it('accepts Unicode symbols and letters in passwords', async () => {
    expect((await register({ ...valid, password: 'Müller-Straße-2024' })).status).toBe(201);
  });

  it('answers 409 for a taken email, also with different casing', async () => {
    await register(valid).expect(201);
    expect((await register({ ...valid, email: 'ADA@example.com' })).status).toBe(409);
  });

  it('rejects NoSQL operators and unknown fields', async () => {
    await register({ ...valid, email: { $gt: '' } }).expect(400);
    expect((await register({ ...valid, isEmailVerified: true })).status).toBe(400);
  });
});

describe('POST /v1/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const user = await createUser();
    const res = await login(user.email).expect(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.tokens.refresh.token).toEqual(expect.any(String));
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const user = await createUser();
    const unknown = await login('nobody@example.com').expect(401);
    const wrong = await login(user.email, 'Wrong-Password-123').expect(401);
    const { requestId: a, ...unknownBody } = unknown.body;
    const { requestId: b, ...wrongBody } = wrong.body;
    expect(unknownBody).toEqual(wrongBody);
    expect(a).not.toBe(b);
    expect(unknown.headers['www-authenticate']).toBeUndefined();
  });

  it('cannot be bypassed with a query operator', async () => {
    await createUser();
    expect(
      (
        await request(app)
          .post('/v1/auth/login')
          .send({ email: { $ne: null }, password: { $ne: null } })
      ).status
    ).toBe(400);
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    const user = await createUser();
    for (let i = 0; i < config.login.maxAttempts; i += 1) {
      await login(user.email, 'Wrong-Password-123').expect(401);
    }
    await login(user.email).expect(401);
    const stored = await db.users.findById(user.id);
    expect(stored.lockUntil.getTime()).toBeGreaterThan(Date.now());

    await db.users.update(user.id, { lockUntil: new Date(Date.now() - 1000) });
    await login(user.email).expect(200);
  });

  it('upgrades a 1.x password hash on successful login', async () => {
    const crypto = require('node:crypto');
    const user = await createUser();
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    await db.users.update(user.id, { password: `${salt}:${key}` });

    await login(user.email).expect(200);
    const stored = await db.users.findById(user.id);
    expect(stored.password).toMatch(/^scrypt\$131072\$/);
  });
});

describe('refresh tokens', () => {
  it('are single use and rotate on every refresh', async () => {
    const user = await createUser();
    const first = await tokensFor(user);
    const res = await request(app)
      .post('/v1/auth/refresh-tokens')
      .send({ refreshToken: first.refresh.token })
      .expect(200);
    expect(res.body.tokens.refresh.token).not.toBe(first.refresh.token);
  });

  it('revoke every session of the user when a used token comes back', async () => {
    const user = await createUser();
    const stolen = await tokensFor(user);
    const other = await tokensFor(user);
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: stolen.refresh.token }).expect(200);
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: stolen.refresh.token }).expect(401);
    expect(await db.tokens.count({ userId: user.id })).toBe(0);
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: other.refresh.token }).expect(401);
  });

  it('are stored only as SHA-256 hashes', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    const doc = await db.tokens.find({ userId: user.id });
    expect(doc.tokenHash).toBe(tokenService.hashToken(tokens.refresh.token));
    expect(JSON.stringify(doc)).not.toContain(tokens.refresh.token);
  });

  it('cannot be used as access tokens and access tokens cannot refresh', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    await request(app).get('/v1/users/profile').set('Authorization', `Bearer ${tokens.refresh.token}`).expect(401);
    expect(
      (await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: tokens.access.token })).status
    ).toBe(401);
  });

  it('are revoked by logout', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    await request(app).post('/v1/auth/logout').send({ refreshToken: tokens.refresh.token }).expect(204);
    expect(
      (await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: tokens.refresh.token })).status
    ).toBe(401);
  });
});

describe('access tokens', () => {
  const forge = (payload, secret = config.jwt.secret, options = {}) =>
    jwt.sign({ type: 'access', ...payload }, secret, {
      algorithm: 'HS256',
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: 60,
      ...options,
    });

  it.each([
    ['another secret', (id) => forge({ sub: id }, 'another-secret-another-secret-another-secret')],
    ['wrong audience', (id) => forge({ sub: id }, undefined, { audience: 'someone-else' })],
    ['wrong issuer', (id) => forge({ sub: id }, undefined, { issuer: 'someone-else' })],
    ['expired', (id) => forge({ sub: id }, undefined, { expiresIn: -10 })],
    [
      'alg none',
      (id) =>
        `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, type: 'access' })).toString('base64url')}.`,
    ],
    ['HS512', (id) => forge({ sub: id }, undefined, { algorithm: 'HS512' })],
  ])('rejects a token with %s', async (label, make) => {
    const user = await createUser();
    await request(app)
      .get('/v1/users/profile')
      .set('Authorization', `Bearer ${make(user.id)}`)
      .expect(401);
  });

  it('stop working after a password change', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await userService.saveChanges(user, { password: 'Brand-New-Password-42' });
    expect((await request(app).get('/v1/users/profile').set(bearer(tokens))).status).toBe(401);
  });

  it('stop working when the user is deleted', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    await db.users.remove(user.id);
    expect((await request(app).get('/v1/users/profile').set(bearer(tokens))).status).toBe(401);
  });

  it('require the Bearer scheme', async () => {
    const user = await createUser();
    const tokens = await tokensFor(user);
    await request(app).get('/v1/users/profile').set('Authorization', tokens.access.token).expect(401);
    const res = await request(app).get('/v1/users/profile').expect(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });
});
