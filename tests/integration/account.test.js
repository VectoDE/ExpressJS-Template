const request = require('supertest');
const app = require('../../src/app');
const { useDatabase, db } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { PASSWORD, createUser, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();

const signedIn = async () => {
  const user = await createUser();
  const tokens = await tokensFor(user);
  return { user, tokens, headers: bearer(tokens) };
};

describe('GET /v1/account/export (GDPR Art. 15 and 20)', () => {
  it('returns all stored personal data as a JSON download without secrets', async () => {
    const { user, headers } = await signedIn();
    const res = await request(app).get('/v1/account/export').set(headers).expect(200);
    expect(res.headers['content-disposition']).toContain('account-export.json');
    expect(res.body.account).toMatchObject({ id: user.id, email: user.email, name: user.name, role: 'user' });
    expect(res.body.activeApiSessions).toHaveLength(1);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('scrypt$');
    expect(raw).not.toMatch(/tokenHash|failedLoginAttempts|lockUntil/);
  });

  it('requires authentication', async () => {
    await request(app).get('/v1/account/export').expect(401);
  });
});

describe('PATCH /v1/account (GDPR Art. 16)', () => {
  it('lets users correct their name without re-entering the password', async () => {
    const { headers } = await signedIn();
    const res = await request(app).patch('/v1/account').set(headers).send({ name: 'Corrected Name' }).expect(200);
    expect(res.body.user.name).toBe('Corrected Name');
  });

  it('requires the current password for email and password changes', async () => {
    const { headers } = await signedIn();
    await request(app).patch('/v1/account').set(headers).send({ email: 'new@example.com' }).expect(400);
    expect(
      (
        await request(app)
          .patch('/v1/account')
          .set(headers)
          .send({ email: 'new@example.com', currentPassword: 'Wrong-Password-1' })
      ).status
    ).toBe(403);
  });

  it('changes the password, revokes all tokens and keeps roles untouchable', async () => {
    const { user, headers } = await signedIn();
    await request(app).patch('/v1/account').set(headers).send({ role: 'admin' }).expect(400);
    await request(app)
      .patch('/v1/account')
      .set(headers)
      .send({ password: 'Fresh-Password-2025', currentPassword: PASSWORD })
      .expect(200);
    expect(await db.tokens.count({ userId: user.id })).toBe(0);
    await request(app).post('/v1/auth/login').send({ email: user.email, password: 'Fresh-Password-2025' }).expect(200);
  });

  it('refuses an email that belongs to someone else', async () => {
    const other = await createUser();
    const { headers } = await signedIn();
    expect(
      (await request(app).patch('/v1/account').set(headers).send({ email: other.email, currentPassword: PASSWORD }))
        .status
    ).toBe(409);
  });
});

describe('DELETE /v1/account (GDPR Art. 17)', () => {
  it('needs the password and then erases the account and its tokens', async () => {
    const { user, headers } = await signedIn();
    await request(app).delete('/v1/account').set(headers).send({ password: 'Wrong-Password-1' }).expect(403);
    await request(app).delete('/v1/account').set(headers).send({}).expect(400);
    await request(app).delete('/v1/account').set(headers).send({ password: PASSWORD }).expect(204);
    expect(await db.users.findById(user.id)).toBeNull();
    expect(await db.tokens.count({ userId: user.id })).toBe(0);
    await request(app).get('/v1/users/profile').set(headers).expect(401);
  });
});

describe('account self-service in the browser', () => {
  const signIn = async (user) => {
    const client = browser(app);
    await client.submit('/login', { email: user.email, password: PASSWORD });
    return client;
  };

  it('downloads the data export', async () => {
    const user = await createUser();
    const client = await signIn(user);
    const res = await client.agent.get('/account/export').expect(200);
    expect(res.headers['content-disposition']).toContain('account-export.json');
    expect(JSON.parse(res.text).account.email).toBe(user.email);
  });

  it('deletes the account only with the right password and a CSRF token', async () => {
    const user = await createUser();
    const client = await signIn(user);

    await client.agent.post('/account/delete').type('form').send({ password: PASSWORD }).expect(302);
    expect(await db.users.findById(user.id)).not.toBeNull();

    const wrong = await client.submit('/account/delete', { password: 'Wrong-Password-1' }, '/dashboard');
    expect(wrong.headers.location).toBe('/dashboard');
    const empty = await client.submit('/account/delete', {}, '/dashboard');
    expect(empty.headers.location).toBe('/dashboard');
    expect(await db.users.findById(user.id)).not.toBeNull();

    const done = await client.submit('/account/delete', { password: PASSWORD }, '/dashboard');
    expect(done.headers.location).toBe('/?deleted=1');
    expect(await db.users.findById(user.id)).toBeNull();
    const home = await client.agent.get('/?deleted=1');
    expect(home.text).toContain('Your account and all its data are deleted.');
  });

  const flashOn = async (client, path = '/dashboard') => (await client.agent.get(path).set('Accept', 'text/html')).text;

  it('changes the name without a password and keeps the session', async () => {
    const user = await createUser();
    const client = await signIn(user);

    const res = await client.submit('/account/profile', { name: 'Renamed User', email: user.email }, '/dashboard');
    expect(res.headers.location).toBe('/dashboard');
    const page = await flashOn(client);
    expect(page).toContain('Your profile is saved.');
    expect(page).toContain('Hello, Renamed User');
    expect((await db.users.findById(user.id)).name).toBe('Renamed User');
  });

  it('reports an unchanged profile and German validation errors', async () => {
    const user = await createUser();
    const client = await signIn(user);

    await client.submit('/account/profile', { name: user.name, email: user.email }, '/dashboard');
    expect(await flashOn(client)).toContain('There was nothing to change.');

    await client.submit('/account/profile', { name: 'x', email: user.email }, '/dashboard');
    expect(await flashOn(client)).toContain('The name must be 3 to 120 characters long.');
  });

  it('changes the email only with the current password and never to a taken address', async () => {
    const user = await createUser();
    const other = await createUser();
    const client = await signIn(user);

    await client.submit('/account/profile', { name: user.name, email: 'new@example.com' }, '/dashboard');
    expect(await flashOn(client)).toContain('enter your current password');

    const form = { name: user.name, email: 'new@example.com', currentPassword: 'Wrong-Password-1' };
    await client.submit('/account/profile', form, '/dashboard');
    expect(await flashOn(client)).toContain('The current password is incorrect.');

    await client.submit('/account/profile', { ...form, email: other.email, currentPassword: PASSWORD }, '/dashboard');
    expect(await flashOn(client)).toContain('This email address cannot be used.');
    expect((await db.users.findById(user.id)).email).toBe(user.email);

    await client.submit('/account/profile', { ...form, currentPassword: PASSWORD }, '/dashboard');
    expect(await flashOn(client)).toContain('Your profile is saved.');
    expect((await db.users.findById(user.id)).email).toBe('new@example.com');
  });

  it('changes the password, keeps this browser signed in and ends every other session and token', async () => {
    const user = await createUser();
    const client = await signIn(user);
    const otherBrowser = await signIn(user);
    const { refresh } = await tokensFor(user);
    const next = 'Brand-New-Secret-42';

    await client.submit(
      '/account/password',
      { currentPassword: PASSWORD, password: next, passwordConfirm: 'Brand-New-Secret-43' },
      '/dashboard'
    );
    expect(await flashOn(client)).toContain('The two new passwords do not match.');

    await client.submit(
      '/account/password',
      { currentPassword: 'Wrong-Password-1', password: next, passwordConfirm: next },
      '/dashboard'
    );
    expect(await flashOn(client)).toContain('The current password is incorrect.');

    await client.submit(
      '/account/password',
      { currentPassword: PASSWORD, password: 'short', passwordConfirm: 'short' },
      '/dashboard'
    );
    expect(await flashOn(client)).toContain('The password needs 12 to 128 characters');

    // Credential changes are compared at second precision, so the change must land in a later second.
    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });
    await client.submit(
      '/account/password',
      { currentPassword: PASSWORD, password: next, passwordConfirm: next },
      '/dashboard'
    );
    expect(await flashOn(client)).toContain('Your password is changed.');

    await otherBrowser.agent.get('/dashboard').set('Accept', 'text/html').expect(302);
    await request(app).post('/v1/auth/refresh-tokens').send({ refreshToken: refresh.token }).expect(401);
    await request(app).post('/v1/auth/login').send({ email: user.email, password: next }).expect(200);
  });

  it('serves the imprint placeholder', async () => {
    const res = await request(app).get('/imprint').expect(200);
    expect(res.text).toContain('§ 5 DDG');
  });
});
