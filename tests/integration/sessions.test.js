// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const request = require('supertest');
const app = require('../../src/app');
const { useDatabase, db, hasAuditEvent } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { PASSWORD, createUser } = require('../helpers/fixtures');

useDatabase();

const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';

const login = (user, ua = FIREFOX) =>
  request(app).post('/v1/auth/login').set('User-Agent', ua).send({ email: user.email, password: PASSWORD }).expect(200);

const bearer = (res) => ({ Authorization: `Bearer ${res.body.tokens.access.token}` });

describe('API sessions', () => {
  it('lists one entry per sign-in with a device label and keeps it across refreshes', async () => {
    const user = await createUser();
    const first = await login(user);
    await login(user, 'curl/8.9.1');

    const list = await request(app).get('/v1/account/sessions').set(bearer(first)).expect(200);
    expect(list.body.results).toHaveLength(2);
    expect(list.body.results.map((session) => session.device).sort((a, b) => a.localeCompare(b))).toEqual([
      'curl',
      'Firefox · Windows',
    ]);

    const firefox = list.body.results.find((session) => session.device === 'Firefox · Windows');
    await request(app)
      .post('/v1/auth/refresh-tokens')
      .set('User-Agent', FIREFOX)
      .send({ refreshToken: first.body.tokens.refresh.token })
      .expect(200);
    const after = await request(app).get('/v1/account/sessions').set(bearer(first)).expect(200);
    expect(after.body.results).toHaveLength(2);
    expect(after.body.results.map((session) => session.id)).toContain(firefox.id);
    expect(new Date(after.body.results.find((s) => s.id === firefox.id).startedAt)).toEqual(
      new Date(firefox.startedAt)
    );
  });

  it('signs out a single API client', async () => {
    const user = await createUser();
    const first = await login(user);
    const second = await login(user, 'curl/8.9.1');
    const list = await request(app).get('/v1/account/sessions').set(bearer(first)).expect(200);
    const curl = list.body.results.find((session) => session.device === 'curl');

    await request(app).delete(`/v1/account/sessions/${curl.id}`).set(bearer(first)).expect(204);
    await request(app)
      .post('/v1/auth/refresh-tokens')
      .send({ refreshToken: second.body.tokens.refresh.token })
      .expect(401);
    await request(app)
      .post('/v1/auth/refresh-tokens')
      .send({ refreshToken: first.body.tokens.refresh.token })
      .expect(200);
    await request(app).delete(`/v1/account/sessions/${curl.id}`).set(bearer(first)).expect(404);
    expect((await request(app).delete('/v1/account/sessions/not%20valid').set(bearer(first))).status).toBe(400);
  });

  it('cannot sign out sessions of another account', async () => {
    const owner = await createUser();
    const other = await createUser();
    await login(owner);
    const otherLogin = await login(other);
    const [ownerSession] = (await db.tokens.list({ userId: owner.id })).map((token) => token.family);
    await request(app).delete(`/v1/account/sessions/${ownerSession}`).set(bearer(otherLogin)).expect(404);
    expect(await db.tokens.count({ userId: owner.id })).toBe(1);
  });

  it('signs out everywhere, including access tokens', async () => {
    const user = await createUser();
    const first = await login(user);
    // No wait on purpose: a token from the same second as the sign-out must stop working too.
    const second = await login(user);
    await request(app).delete('/v1/account/sessions').set(bearer(first)).expect(204);
    await request(app).get('/v1/users/profile').set(bearer(second)).expect(401);
    await request(app)
      .post('/v1/auth/refresh-tokens')
      .send({ refreshToken: second.body.tokens.refresh.token })
      .expect(401);
    expect(await hasAuditEvent(user.id, 'allSessionsRevoked')).toBeTruthy();
  });
});

describe('activity log', () => {
  it('records sign-ins and failures with a device label but no IP address', async () => {
    const user = await createUser();
    await request(app).post('/v1/auth/login').send({ email: user.email, password: 'Wrong-Password-1' }).expect(401);
    const ok = await login(user);
    const res = await request(app).get('/v1/account/activity').set(bearer(ok)).expect(200);
    expect(res.body.results.map((event) => event.type)).toEqual(['login', 'loginFailed']);
    expect(res.body.results[0]).toEqual({ type: 'login', device: 'Firefox · Windows', createdAt: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toMatch(/127\.0\.0\.1|::1|"ip"/);
  });

  it('flags refresh token reuse', async () => {
    const user = await createUser();
    const first = await login(user);
    const { refresh } = first.body.tokens;
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: refresh.token }).expect(200);
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: refresh.token }).expect(401);
    expect(await hasAuditEvent(user.id, 'refreshTokenReuse')).toBeTruthy();
  });

  it('is part of the export and removed with the account', async () => {
    const user = await createUser();
    const res = await login(user);
    const exported = await request(app).get('/v1/account/export').set(bearer(res)).expect(200);
    expect(exported.body.activity[0]).toMatchObject({ type: 'login' });
    expect(exported.body.format).toBe('expressjs-template/account-export@2');

    await request(app).delete('/v1/account').set(bearer(res)).send({ password: PASSWORD }).expect(204);
    expect(await (await db.audit.types(user.id)).length).toBe(0);
    expect(await db.tokens.count({ userId: user.id })).toBe(0);
  });
});

describe('sessions and activity in the browser', () => {
  it('lists API clients, signs one out and keeps the browser signed in after "everywhere else"', async () => {
    const user = await createUser();
    await login(user, 'curl/8.9.1');
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });

    const dashboard = await client.agent.get('/dashboard').set('Accept', 'text/html').expect(200);
    expect(dashboard.text).toContain('curl');
    expect(dashboard.text).toContain('Sign-in');
    const sessionId = /action="\/account\/sessions\/([A-Za-z0-9-]+)\/revoke"/.exec(dashboard.text)[1];

    const revoked = await client.submit(`/account/sessions/${sessionId}/revoke`, {}, '/dashboard');
    expect(revoked.headers.location).toBe('/dashboard#sessions');
    expect(await db.tokens.count({ userId: user.id })).toBe(0);

    const other = browser(app);
    await other.submit('/login', { email: user.email, password: PASSWORD });
    const all = await client.submit('/account/sessions/revoke-all', {}, '/dashboard');
    expect(all.headers.location).toBe('/dashboard#sessions');
    await client.agent.get('/dashboard').set('Accept', 'text/html').expect(200);
    const kicked = await other.agent.get('/dashboard').set('Accept', 'text/html');
    expect(kicked.headers.location).toBe('/login');
  });
});
