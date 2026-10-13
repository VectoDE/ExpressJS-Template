// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const request = require('supertest');
const app = require('../../src/app');
const totp = require('../../src/utils/totp');
const { useDatabase, db, hasAuditEvent } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { waitForMail, mailTo, clearOutbox } = require('../helpers/mail');
const { PASSWORD, createUser, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();
beforeEach(clearOutbox);

// The step right after the current one: valid within the drift window and never used before.
const nextCode = (secret) => totp.generate(secret, Date.now() + 30000);

const signedIn = async () => {
  const user = await createUser();
  return { user, headers: bearer(await tokensFor(user)) };
};

const enableFor = async (headers) => {
  const setup = await request(app).post('/v1/account/2fa/setup').set(headers).send({ password: PASSWORD }).expect(200);
  const enabled = await request(app)
    .post('/v1/account/2fa/enable')
    .set(headers)
    .send({ code: totp.generate(setup.body.secret) })
    .expect(200);
  return { secret: setup.body.secret, recoveryCodes: enabled.body.recoveryCodes };
};

const challengeFor = async (user) => {
  const res = await request(app).post('/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
  return res.body;
};

describe('two-factor setup (API)', () => {
  it('stores a pending secret encrypted and returns a QR code', async () => {
    const { user, headers } = await signedIn();
    const res = await request(app).post('/v1/account/2fa/setup').set(headers).send({ password: PASSWORD }).expect(200);
    expect(res.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(res.body.otpauthUrl).toContain(`secret=${res.body.secret}`);
    expect(res.body.qrSvg.startsWith('<svg')).toBe(true);

    const stored = await db.users.findById(user.id);
    expect(stored.twoFactor.enabled).toBe(false);
    expect(stored.twoFactor.pendingSecret).toMatch(/^v1\./);
    expect(stored.twoFactor.pendingSecret).not.toContain(res.body.secret);

    const status = await request(app).get('/v1/account/2fa').set(headers).expect(200);
    expect(status.body).toMatchObject({ enabled: false, setupPending: true });
  });

  it('needs the current password to start', async () => {
    const { headers } = await signedIn();
    expect(
      (await request(app).post('/v1/account/2fa/setup').set(headers).send({ password: 'Wrong-Password-1' })).status
    ).toBe(403);
  });

  it('activates only with a valid code and returns ten recovery codes once', async () => {
    const { user, headers } = await signedIn();
    const setup = await request(app).post('/v1/account/2fa/setup').set(headers).send({ password: PASSWORD });
    await request(app).post('/v1/account/2fa/enable').set(headers).send({ code: '000000' }).expect(400);
    const res = await request(app)
      .post('/v1/account/2fa/enable')
      .set(headers)
      .send({ code: totp.generate(setup.body.secret) })
      .expect(200);
    expect(res.body.recoveryCodes).toHaveLength(10);
    res.body.recoveryCodes.forEach((code) => expect(code).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/));

    const stored = await db.users.findById(user.id);
    expect(stored.twoFactor.enabled).toBe(true);
    expect(stored.twoFactor.recoveryCodes).not.toContain(res.body.recoveryCodes[0]);
    await waitForMail(mailTo(user.email, 'twoFactorEnabled'));
    expect(await hasAuditEvent(user.id, 'twoFactorEnabled')).toBeTruthy();

    await request(app).post('/v1/account/2fa/enable').set(headers).send({ code: '123456' }).expect(409);
  });

  it('refuses to enable without a started setup', async () => {
    const { headers } = await signedIn();
    const res = await request(app).post('/v1/account/2fa/enable').set(headers).send({ code: '123456' }).expect(400);
    expect(res.body.message).toBe('Start the two-factor setup first');
  });
});

describe('sign-in with two factors (API)', () => {
  it('returns a challenge instead of tokens and completes with a code', async () => {
    const { user, headers } = await signedIn();
    const { secret } = await enableFor(headers);

    const challenge = await challengeFor(user);
    expect(challenge).toMatchObject({ twoFactorRequired: true, expiresIn: 300 });
    expect(challenge.tokens).toBeUndefined();

    const code = nextCode(secret);
    const res = await request(app)
      .post('/v1/auth/login/2fa')
      .send({ challengeToken: challenge.challengeToken, code })
      .expect(200);
    expect(res.body.tokens.access.token).toBeDefined();
    expect(res.body.user.twoFactorEnabled).toBe(true);

    // The same code cannot be used a second time.
    await request(app).post('/v1/auth/login/2fa').send({ challengeToken: challenge.challengeToken, code }).expect(401);
  });

  it('accepts each recovery code once', async () => {
    const { user, headers } = await signedIn();
    const { recoveryCodes } = await enableFor(headers);
    const { challengeToken } = await challengeFor(user);

    const res = await request(app)
      .post('/v1/auth/login/2fa')
      .send({ challengeToken, code: recoveryCodes[0].toUpperCase() })
      .expect(200);
    expect(res.headers['x-recovery-codes-remaining']).toBe('9');
    await request(app).post('/v1/auth/login/2fa').send({ challengeToken, code: recoveryCodes[0] }).expect(401);
    expect(await hasAuditEvent(user.id, 'recoveryCodeUsed')).toBeTruthy();
  });

  it('counts wrong codes towards the account lockout', async () => {
    const { user, headers } = await signedIn();
    const { secret } = await enableFor(headers);
    const { challengeToken } = await challengeFor(user);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app).post('/v1/auth/login/2fa').send({ challengeToken, code: '000000' }).expect(401);
    }
    expect(
      (
        await request(app)
          .post('/v1/auth/login/2fa')
          .send({ challengeToken, code: nextCode(secret) })
      ).status
    ).toBe(401);
    await waitForMail(mailTo(user.email, 'accountLocked'));
  });

  it('keeps counting wrong codes when the password is entered again in between', async () => {
    const { user, headers } = await signedIn();
    const { secret } = await enableFor(headers);
    const first = await challengeFor(user);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app).post('/v1/auth/login/2fa').send({ challengeToken: first.challengeToken, code: '000000' });
    }
    // A correct password must not reset the counter, otherwise codes could be guessed without end.
    const second = await challengeFor(user);
    await request(app).post('/v1/auth/login/2fa').send({ challengeToken: second.challengeToken, code: '000000' });
    const res = await request(app)
      .post('/v1/auth/login/2fa')
      .send({ challengeToken: second.challengeToken, code: nextCode(secret) });
    expect(res.status).toBe(401);
  });

  it('rejects other token types and challenges issued before a password change', async () => {
    const { user, headers } = await signedIn();
    const { secret } = await enableFor(headers);
    const access = (await tokensFor(user)).access.token;
    await request(app)
      .post('/v1/auth/login/2fa')
      .send({ challengeToken: access, code: nextCode(secret) })
      .expect(401);

    const { challengeToken } = await challengeFor(user);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await db.users.update(user.id, { credentialsChangedAt: new Date() });
    expect(
      (
        await request(app)
          .post('/v1/auth/login/2fa')
          .send({ challengeToken, code: nextCode(secret) })
      ).status
    ).toBe(401);
  });
});

describe('turning two-factor off and renewing codes (API)', () => {
  it('needs password and a valid code to disable', async () => {
    const { user, headers } = await signedIn();
    const { recoveryCodes } = await enableFor(headers);
    await request(app)
      .post('/v1/account/2fa/disable')
      .set(headers)
      .send({ password: 'Wrong-Password-1', code: recoveryCodes[0] })
      .expect(403);
    await request(app)
      .post('/v1/account/2fa/disable')
      .set(headers)
      .send({ password: PASSWORD, code: '000000' })
      .expect(403);
    await request(app)
      .post('/v1/account/2fa/disable')
      .set(headers)
      .send({ password: PASSWORD, code: recoveryCodes[1] })
      .expect(204);

    const login = await request(app).post('/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    expect(login.body.tokens).toBeDefined();
    await waitForMail(mailTo(user.email, 'twoFactorDisabled'));
  });

  it('replaces all recovery codes', async () => {
    const { user, headers } = await signedIn();
    const { recoveryCodes } = await enableFor(headers);
    const renewed = await request(app)
      .post('/v1/account/2fa/recovery-codes')
      .set(headers)
      .send({ code: recoveryCodes[0] })
      .expect(200);
    expect(renewed.body.recoveryCodes).toHaveLength(10);
    const { challengeToken } = await challengeFor(user);
    await request(app).post('/v1/auth/login/2fa').send({ challengeToken, code: recoveryCodes[1] }).expect(401);
    await request(app)
      .post('/v1/auth/login/2fa')
      .send({ challengeToken, code: renewed.body.recoveryCodes[0] })
      .expect(200);
  });

  it('never exports the secret or the recovery codes', async () => {
    const { headers } = await signedIn();
    const { secret, recoveryCodes } = await enableFor(headers);
    const res = await request(app).get('/v1/account/export').set(headers).expect(200);
    expect(res.body.twoFactor).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain(recoveryCodes[0]);
    expect(raw).not.toMatch(/pendingSecret|"secret"/);
  });
});

describe('two-factor in the browser', () => {
  const signIn = async (user) => {
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });
    return client;
  };

  it('sets up with a QR code, shows recovery codes once and asks for a code at sign-in', async () => {
    const user = await createUser();
    const client = await signIn(user);

    await client.submit('/account/2fa/setup', { password: PASSWORD }, '/dashboard');
    const setupPage = await client.agent.get('/dashboard').set('Accept', 'text/html');
    expect(setupPage.text).toContain('<svg');
    const secret = /<code>([A-Z2-7 ]{39})<\/code>/.exec(setupPage.text)[1].replace(/ /g, '');

    await client.submit('/account/2fa/enable', { code: totp.generate(secret) }, '/dashboard');
    const withCodes = await client.agent.get('/dashboard').set('Accept', 'text/html');
    const codes = [...withCodes.text.matchAll(/<li><code>([0-9a-f]{5}-[0-9a-f]{5})<\/code><\/li>/g)];
    expect(codes).toHaveLength(10);
    const again = await client.agent.get('/dashboard').set('Accept', 'text/html');
    expect(again.text).not.toContain(codes[0][1]);

    const fresh = browser(app);
    const login = await fresh.submit('/login', { email: user.email, password: PASSWORD });
    expect(login.headers.location).toBe('/login/2fa');
    const wrong = await fresh.submit('/login/2fa', { code: '000000' });
    expect(wrong.headers.location).toBe('/login/2fa');
    const done = await fresh.submit('/login/2fa', { code: codes[3][1] });
    expect(done.headers.location).toBe('/dashboard');
    const dashboard = await fresh.agent.get('/dashboard').set('Accept', 'text/html').expect(200);
    expect(dashboard.text).toContain('recovery code');
  });

  it('sends the code step back to the password step when nothing is pending', async () => {
    const client = browser(app);
    const res = await client.agent.get('/login/2fa').set('Accept', 'text/html').expect(302);
    expect(res.headers.location).toBe('/login');
  });
});
