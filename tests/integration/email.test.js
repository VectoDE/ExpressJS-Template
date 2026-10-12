const request = require('supertest');
const app = require('../../src/app');
const config = require('../../src/config/config');
const emailService = require('../../src/services/email.service');
const { useDatabase, db, hasAuditEvent, expireTokens } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { waitForMail, mailTo, tokenFrom, clearOutbox } = require('../helpers/mail');
const { PASSWORD, createUser, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();
beforeEach(clearOutbox);

const NEW_PASSWORD = 'Another-Strong-Pass-42';

const register = (body = {}) =>
  request(app)
    .post('/v1/auth/register')
    .send({ name: 'Mail Tester', email: 'mail.tester@example.com', password: PASSWORD, ...body });

describe('email templates', () => {
  it.each(emailService.TEMPLATES)('renders %s in German and English with text and HTML', async (template) => {
    const data = { name: 'Ada', token: 'tok_123', newEmail: 'new@example.com' };
    const de = await emailService.compose(template, { ...data, locale: 'de' });
    const en = await emailService.compose(template, { ...data, locale: 'en' });
    expect(de.subject).not.toBe(en.subject);
    expect(de.text).toContain('Hallo Ada,');
    expect(en.text).toContain('Hello Ada,');
    expect(de.html).toContain('<html lang="de">');
    expect(en.html).toContain('<html lang="en">');
    expect(`${de.text}${de.html}`).not.toMatch(/emails\.|\{\w+\}/);
  });

  it('escapes user input in the HTML version', async () => {
    const { html } = await emailService.compose('passwordChanged', {
      name: '<img src=x onerror=alert(1)>',
      locale: 'en',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('puts the link with the token into verification and reset emails', async () => {
    const verify = await emailService.compose('verifyEmail', { name: 'Ada', token: 'abc', locale: 'en' });
    expect(verify.text).toContain(`${config.appUrl}/verify-email?token=abc`);
    const reset = await emailService.compose('resetPassword', { name: 'Ada', token: 'xyz', locale: 'en' });
    expect(reset.text).toContain(`${config.appUrl}/reset-password?token=xyz`);
  });
});

describe('email verification (API)', () => {
  it('sends a link at sign-up in the chosen language and verifies once', async () => {
    const res = await register({ locale: 'en' }).expect(201);
    expect(res.body.user.isEmailVerified).toBe(false);
    const mail = await waitForMail(mailTo('mail.tester@example.com', 'verifyEmail'));
    expect(mail.subject).toBe('Confirm your email address');

    const token = tokenFrom(mail);
    await request(app).post('/v1/auth/verify-email').send({ token }).expect(204);
    expect((await db.users.findById(res.body.user.id)).isEmailVerified).toBe(true);
    await request(app).post('/v1/auth/verify-email').send({ token }).expect(400);
    expect(await hasAuditEvent(res.body.user.id, 'emailVerified')).toBeTruthy();
  });

  it('stores only a hash of the token', async () => {
    await register().expect(201);
    const token = tokenFrom(await waitForMail(mailTo('mail.tester@example.com', 'verifyEmail')));
    const stored = await db.tokens.find({ type: 'verifyEmail' });
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not verify a new address with a link sent to the old one', async () => {
    const user = await createUser();
    const headers = bearer(await tokensFor(user));
    await request(app).post('/v1/auth/send-verification-email').set(headers).expect(204);
    const token = tokenFrom(await waitForMail(mailTo(user.email, 'verifyEmail')));
    await request(app)
      .patch('/v1/account')
      .set(headers)
      .send({ email: 'changed@example.com', currentPassword: PASSWORD })
      .expect(200);
    expect((await request(app).post('/v1/auth/verify-email').send({ token })).status).toBe(400);
    await waitForMail(mailTo(user.email, 'emailChanged'));
    await waitForMail(mailTo('changed@example.com', 'verifyEmail'));
  });

  it('resends only for unverified addresses and only when signed in', async () => {
    await request(app).post('/v1/auth/send-verification-email').expect(401);
    const user = await createUser({ isEmailVerified: true });
    await request(app)
      .post('/v1/auth/send-verification-email')
      .set(bearer(await tokensFor(user)))
      .expect(400);
  });

  it('rejects malformed and unknown tokens', async () => {
    await request(app).post('/v1/auth/verify-email').send({ token: 'short' }).expect(400);
    expect(
      (
        await request(app)
          .post('/v1/auth/verify-email')
          .send({ token: 'a'.repeat(43) })
      ).status
    ).toBe(400);
  });

  it('can require a verified address before sign-in', async () => {
    config.auth.requireVerifiedEmail = true;
    try {
      const res = await register().expect(201);
      expect(res.body.tokens).toBeUndefined();
      expect(res.body.verificationRequired).toBe(true);
      clearOutbox();
      const login = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'mail.tester@example.com', password: PASSWORD })
        .expect(403);
      expect(login.body.message).toContain('not verified');
      await waitForMail(mailTo('mail.tester@example.com', 'verifyEmail'));
      // A wrong password still gets the generic answer, so the check reveals nothing.
      await request(app)
        .post('/v1/auth/login')
        .send({ email: 'mail.tester@example.com', password: 'Wrong-Password-1' })
        .expect(401);
    } finally {
      config.auth.requireVerifiedEmail = false;
    }
  });
});

describe('password reset (API)', () => {
  const resetMailFor = async (email) => {
    await request(app).post('/v1/auth/forgot-password').send({ email }).expect(204);
    return waitForMail(mailTo(email, 'resetPassword'));
  };

  it('answers the same for unknown addresses and sends nothing', async () => {
    await request(app).post('/v1/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(204);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(emailService.outbox).toHaveLength(0);
  });

  it('sets a new password, ends every session and lifts a lockout', async () => {
    const user = await createUser({ lockUntil: new Date(Date.now() + 60000) });
    const tokens = await tokensFor(user);
    const token = tokenFrom(await resetMailFor(user.email));

    await request(app).post('/v1/auth/reset-password').send({ token, password: NEW_PASSWORD }).expect(204);
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: tokens.refresh.token }).expect(401);
    await request(app).post('/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(401);
    await request(app).post('/v1/auth/login').send({ email: user.email, password: NEW_PASSWORD }).expect(200);
    await waitForMail(mailTo(user.email, 'passwordChanged'));

    const types = await db.audit.types(user.id);
    expect(types).toEqual(expect.arrayContaining(['passwordResetRequested', 'passwordReset']));
  });

  it('accepts each link once and only the newest one', async () => {
    const user = await createUser();
    const first = tokenFrom(await resetMailFor(user.email));
    clearOutbox();
    const second = tokenFrom(await resetMailFor(user.email));
    await request(app).post('/v1/auth/reset-password').send({ token: first, password: NEW_PASSWORD }).expect(400);
    await request(app).post('/v1/auth/reset-password').send({ token: second, password: NEW_PASSWORD }).expect(204);
    expect(
      (await request(app).post('/v1/auth/reset-password').send({ token: second, password: NEW_PASSWORD })).status
    ).toBe(400);
  });

  it('rejects expired links and weak passwords', async () => {
    const user = await createUser();
    const token = tokenFrom(await resetMailFor(user.email));
    await request(app).post('/v1/auth/reset-password').send({ token, password: 'weak' }).expect(400);
    await expireTokens('resetPassword');
    expect((await request(app).post('/v1/auth/reset-password').send({ token, password: NEW_PASSWORD })).status).toBe(
      400
    );
  });
});

describe('password reset and verification in the browser', () => {
  it('runs the whole reset flow and never confirms that an account exists', async () => {
    const user = await createUser();
    const client = browser(app);
    const unknown = await client.submit('/forgot-password', { email: 'nobody@example.com' });
    const known = await client.submit('/forgot-password', { email: user.email });
    expect(unknown.headers.location).toBe('/login');
    expect(known.headers.location).toBe('/login');

    const token = tokenFrom(await waitForMail(mailTo(user.email, 'resetPassword')));
    const form = await client.agent.get(`/reset-password?token=${token}`).set('Accept', 'text/html').expect(200);
    expect(form.text).toContain(`value="${token}"`);
    expect(form.headers['referrer-policy']).toBe('no-referrer');

    const mismatch = await client.submit(
      '/reset-password',
      { token, password: NEW_PASSWORD, passwordConfirm: 'Different-Pass-42' },
      `/reset-password?token=${token}`
    );
    expect(mismatch.headers.location).toBe(`/reset-password?token=${token}`);

    const done = await client.submit(
      '/reset-password',
      { token, password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD },
      `/reset-password?token=${token}`
    );
    expect(done.headers.location).toBe('/login');
    const signIn = await client.submit('/login', { email: user.email, password: NEW_PASSWORD });
    expect(signIn.headers.location).toBe('/dashboard');
  });

  it('sends invalid reset links back to the request form', async () => {
    const client = browser(app);
    const res = await client.agent.get('/reset-password?token=not-a-real-token-123456').set('Accept', 'text/html');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/forgot-password');
  });

  it('confirms an address only after a click on the button', async () => {
    const user = await createUser();
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });
    await client.submit('/account/verification', {}, '/dashboard');
    const token = tokenFrom(await waitForMail(mailTo(user.email, 'verifyEmail')));

    const page = await client.agent.get(`/verify-email?token=${token}`).set('Accept', 'text/html').expect(200);
    expect(page.text).toContain('action="/verify-email"');
    expect((await db.users.findById(user.id)).isEmailVerified).toBe(false);

    const res = await client.submit('/verify-email', { token }, `/verify-email?token=${token}`);
    expect(res.headers.location).toBe('/dashboard');
    expect((await db.users.findById(user.id)).isEmailVerified).toBe(true);
    const dashboard = await client.agent.get('/dashboard').set('Accept', 'text/html');
    expect(dashboard.text).not.toContain('action="/account/verification"');
  });
});
