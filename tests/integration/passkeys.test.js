// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const request = require('supertest');
const app = require('../../src/app');
const totp = require('../../src/utils/totp');
const { useDatabase, db, hasAuditEvent } = require('../helpers/db');
const { waitForMail, mailTo, clearOutbox } = require('../helpers/mail');
const { browser } = require('../helpers/web');
const { createAuthenticator } = require('../helpers/passkey');
const { newId } = require('../../src/utils/id');
const { decrypt } = require('../../src/utils/crypto');
const { PASSWORD, createUser, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();
beforeEach(clearOutbox);

const signedIn = async ({ twoFactor = true } = {}) => {
  const user = await createUser();
  const headers = bearer(await tokensFor(user));
  if (!twoFactor) {
    return { user, headers };
  }
  const setup = await request(app).post('/v1/account/2fa/setup').set(headers).send({ password: PASSWORD });
  await request(app)
    .post('/v1/account/2fa/enable')
    .set(headers)
    .send({ code: totp.generate(setup.body.secret) })
    .expect(200);
  return { user, headers, secret: setup.body.secret };
};

const addPasskey = async (headers, authenticator = createAuthenticator(), name = 'Laptop') => {
  const options = await request(app).post('/v1/account/passkeys/options').set(headers).send({ password: PASSWORD });
  expect(options.status).toBe(200);
  const res = await request(app)
    .post('/v1/account/passkeys')
    .set(headers)
    .send({ name, response: authenticator.register(options.body) })
    .expect(201);
  return { authenticator, passkey: res.body };
};

const challengeFor = async (user) =>
  (await request(app).post('/v1/auth/login').send({ email: user.email, password: PASSWORD }).expect(200)).body
    .challengeToken;

const statusOf = async (pending) => (await pending).status;

const passkeyLogin = async (challengeToken, authenticator, signOptions) => {
  const options = await request(app).post('/v1/auth/login/passkey/options').send({ challengeToken }).expect(200);
  return request(app)
    .post('/v1/auth/login/passkey')
    .send({ challengeToken, response: authenticator.sign(options.body, signOptions) });
};

describe('adding a passkey (API)', () => {
  it('stores the credential for the account and lists it without key material', async () => {
    const { user, headers } = await signedIn();
    const { passkey } = await addPasskey(headers);
    expect(passkey).toEqual({
      id: expect.any(String),
      name: 'Laptop',
      createdAt: expect.any(String),
      lastUsedAt: null,
    });

    const list = await request(app).get('/v1/account/passkeys').set(headers).expect(200);
    expect(list.body.results).toEqual([passkey]);
    const [stored] = await db.passkeys.listForUser(user.id);
    expect(stored.publicKey).toMatch(/^[\w-]+$/);
    expect(stored.transports).toEqual(['internal']);
    await waitForMail(mailTo(user.email, 'passkeyAdded'));
    expect(await hasAuditEvent(user.id, 'passkeyAdded')).toBeTruthy();
  });

  it('needs the password and two-factor sign-in', async () => {
    const { headers } = await signedIn();
    const plain = await signedIn({ twoFactor: false });
    const start = (as, password) => request(app).post('/v1/account/passkeys/options').set(as).send({ password });
    expect(await statusOf(start(headers, 'Wrong-Password-1'))).toBe(403);
    expect(await statusOf(start(plain.headers, PASSWORD))).toBe(400);
  });

  it('accepts a challenge once, only from the right site and only for the same account', async () => {
    const { headers } = await signedIn();
    const other = await signedIn();
    const authenticator = createAuthenticator();
    const options = (await request(app).post('/v1/account/passkeys/options').set(headers).send({ password: PASSWORD }))
      .body;
    const response = authenticator.register(options);
    const add = (as, answer) =>
      statusOf(request(app).post('/v1/account/passkeys').set(as).send({ name: 'x', response: answer }));

    expect(await add(other.headers, response)).toBe(400);
    expect(await add(headers, response)).toBe(201);
    expect(await add(headers, response)).toBe(400);

    // A page on another site gets an answer bound to its own origin; it is rejected and the challenge is spent.
    const next = (await request(app).post('/v1/account/passkeys/options').set(headers).send({ password: PASSWORD }))
      .body;
    expect(await add(headers, createAuthenticator({ origin: 'https://evil.example' }).register(next))).toBe(400);
    expect(await add(headers, createAuthenticator().register(next))).toBe(400);
  });

  it('rejects a malformed response', async () => {
    const { headers } = await signedIn();
    const res = await request(app)
      .post('/v1/account/passkeys')
      .set(headers)
      .send({ name: 'x', response: { id: 'a', rawId: 'a', type: 'password', response: {} } });
    expect(res.status).toBe(400);
  });

  it('allows ten passkeys per account', async () => {
    const { user, headers } = await signedIn();
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        db.passkeys.create({
          id: newId(),
          userId: user.id,
          credentialId: `credential${index}`,
          publicKey: 'key',
          counter: 0,
          transports: [],
          name: `Key ${index}`,
        })
      )
    );
    expect(
      await statusOf(request(app).post('/v1/account/passkeys/options').set(headers).send({ password: PASSWORD }))
    ).toBe(409);
  });

  it('removes a passkey only for its owner', async () => {
    const { user, headers } = await signedIn();
    const other = await signedIn();
    const { passkey } = await addPasskey(headers);
    await request(app).delete(`/v1/account/passkeys/${passkey.id}`).set(other.headers).expect(404);
    await request(app).delete(`/v1/account/passkeys/${passkey.id}`).set(headers).expect(204);
    await request(app).delete(`/v1/account/passkeys/${passkey.id}`).set(headers).expect(404);
    expect(await db.passkeys.listForUser(user.id)).toEqual([]);
    expect(await hasAuditEvent(user.id, 'passkeyRemoved')).toBeTruthy();
  });
});

describe('signing in with a passkey (API)', () => {
  it('replaces the code after the password step and records the use', async () => {
    const { user, headers } = await signedIn();
    const { authenticator } = await addPasskey(headers);
    const res = await passkeyLogin(await challengeFor(user), authenticator);
    expect(res.status).toBe(200);
    expect(res.body.tokens.access.token).toEqual(expect.any(String));
    const [stored] = await db.passkeys.listForUser(user.id);
    expect(stored.counter).toBe(1);
    expect(stored.lastUsedAt).toBeInstanceOf(Date);
  });

  it('has no options without a passkey or without a valid challenge token', async () => {
    const { user } = await signedIn();
    const options = (challengeToken) =>
      statusOf(request(app).post('/v1/auth/login/passkey/options').send({ challengeToken }));
    expect(await options(await challengeFor(user))).toBe(404);
    expect(await options('nope')).toBe(401);
  });

  it('rejects a replayed answer, a foreign passkey and a wrong challenge, and counts them as failures', async () => {
    const { user, headers } = await signedIn();
    const { authenticator } = await addPasskey(headers);
    const stranger = await signedIn();
    const { authenticator: foreign } = await addPasskey(stranger.headers);
    const challengeToken = await challengeFor(user);

    const options = (await request(app).post('/v1/auth/login/passkey/options').send({ challengeToken })).body;
    const answer = authenticator.sign(options);
    await request(app).post('/v1/auth/login/passkey').send({ challengeToken, response: answer }).expect(200);
    await request(app).post('/v1/auth/login/passkey').send({ challengeToken, response: answer }).expect(401);

    expect((await passkeyLogin(challengeToken, foreign)).status).toBe(401);
    expect((await passkeyLogin(challengeToken, authenticator, { challenge: 'made-up' })).status).toBe(401);
    // Three failures lock the account (LOGIN_MAX_ATTEMPTS in the tests), as with wrong codes.
    expect((await db.users.findById(user.id)).lockUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('stops working when two-factor sign-in is turned off', async () => {
    const { user, headers } = await signedIn();
    const { authenticator } = await addPasskey(headers);
    const stored = await db.users.findById(user.id);
    const totpSecret = decrypt(stored.twoFactor.secret);
    await request(app)
      .post('/v1/account/2fa/disable')
      .set(headers)
      .send({ password: PASSWORD, code: totp.generate(totpSecret, Date.now() + 30000) })
      .expect(204);
    expect(await db.passkeys.listForUser(user.id)).toEqual([]);
    expect(authenticator.id).toEqual(expect.any(String));
  });

  it('is part of the data export and goes with the account', async () => {
    const { user, headers } = await signedIn();
    await addPasskey(headers, createAuthenticator(), 'Phone');
    const exported = await request(app).get('/v1/account/export').set(headers).expect(200);
    expect(exported.body.passkeys).toEqual([expect.objectContaining({ name: 'Phone' })]);
    expect(JSON.stringify(exported.body)).not.toContain((await db.passkeys.listForUser(user.id))[0].publicKey);

    await request(app).delete('/v1/account').set(headers).send({ password: PASSWORD }).expect(204);
    expect(await db.passkeys.listForUser(user.id)).toEqual([]);
  });
});

describe('passkeys in the browser', () => {
  const html = (client, path) => client.agent.get(path).set('Accept', 'text/html');
  // The options travel HTML-escaped in data-passkey-options, as the page script reads them.
  const optionsOn = (page) => {
    const match = /data-passkey-options="([^"]+)"/.exec(page.text);
    return match && JSON.parse(match[1].replaceAll('&#34;', '"').replaceAll('&amp;', '&'));
  };
  const csrfOn = (page) => /name="_csrf" value="([^"]+)"/.exec(page.text)[1];

  // Password, then the second step with a code from the app (the step after the one enable used).
  const signIn = async ({ user, secret }) => {
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });
    await client.submit('/login/2fa', { code: totp.generate(secret, Date.now() + 30000) });
    return client;
  };

  it('adds a passkey from the dashboard, signs in with it and removes it', async () => {
    const account = await signedIn();
    const client = await signIn(account);
    const authenticator = createAuthenticator();

    const before = await html(client, '/dashboard');
    expect(optionsOn(before)).toBeNull();
    await client.submit('/account/passkeys/options', { password: PASSWORD }, '/dashboard');
    const ready = await html(client, '/dashboard');
    const options = optionsOn(ready);
    expect(options.rp.id).toBe('localhost');
    const added = await client.agent
      .post('/account/passkeys')
      .type('form')
      .send({ _csrf: csrfOn(ready), name: 'Work laptop', response: JSON.stringify(authenticator.register(options)) });
    expect(added.headers.location).toBe('/dashboard#passkeys');
    const listed = await html(client, '/dashboard');
    expect(listed.text).toContain('Work laptop');
    expect(optionsOn(listed)).toBeNull();

    const fresh = browser(app);
    await fresh.submit('/login', { email: account.user.email, password: PASSWORD });
    const step = await html(fresh, '/login/2fa');
    const loginOptions = optionsOn(step);
    expect(loginOptions.allowCredentials).toEqual([expect.objectContaining({ id: authenticator.id })]);
    const done = await fresh.agent
      .post('/login/2fa/passkey')
      .type('form')
      .send({ _csrf: csrfOn(step), response: JSON.stringify(authenticator.sign(loginOptions)) });
    expect(done.headers.location).toBe('/dashboard');
    await html(fresh, '/dashboard').expect(200);

    const [passkey] = await db.passkeys.listForUser(account.user.id);
    const removed = await client.submit(`/account/passkeys/${passkey.id}/delete`, {}, '/dashboard');
    expect(removed.headers.location).toBe('/dashboard#passkeys');
    expect(await db.passkeys.listForUser(account.user.id)).toEqual([]);
  });

  it('sends a rejected or garbled passkey back to the code step', async () => {
    const account = await signedIn();
    const { authenticator } = await addPasskey(account.headers);
    const client = browser(app);
    await client.submit('/login', { email: account.user.email, password: PASSWORD });
    const step = await html(client, '/login/2fa');
    const wrong = authenticator.sign(optionsOn(step), { challenge: 'made-up' });
    const rejected = await client.agent
      .post('/login/2fa/passkey')
      .type('form')
      .send({ _csrf: csrfOn(step), response: JSON.stringify(wrong) });
    expect(rejected.headers.location).toBe('/login/2fa');
    const garbled = await client.agent
      .post('/login/2fa/passkey')
      .type('form')
      .send({ _csrf: csrfOn(step), response: '{not json' });
    expect(garbled.headers.location).toBe('/login/2fa');
  });

  it('explains on the dashboard that two-factor sign-in comes first', async () => {
    const user = await createUser();
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });
    const page = await html(client, '/dashboard');
    expect(page.text).toContain('Turn on two-factor sign-in first');
    expect(page.text).not.toContain('action="/account/passkeys/options"');
  });
});
