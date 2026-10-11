const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user.model');
const AuditEvent = require('../../src/models/auditEvent.model');
const { useDatabase } = require('../helpers/db');
const { browser } = require('../helpers/web');
const { PASSWORD, createUser, createAdmin, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();

const signIn = async (user) => {
  const client = browser(app);
  await client.submit('/login', { email: user.email, password: PASSWORD });
  return client;
};

const page = (client, path) => client.agent.get(path).set('Accept', 'text/html');

describe('user administration in the browser', () => {
  it('is only for administrators', async () => {
    const client = await signIn(await createUser());
    const res = await page(client, '/admin/users').expect(403);
    expect(res.text).toContain('Zugriff verweigert');
    const dashboard = await page(client, '/dashboard');
    expect(dashboard.text).not.toContain('href="/admin/users"');
    const guest = await page(browser(app), '/admin/users');
    expect(guest.headers.location).toBe('/login');
  });

  it('lists, searches and filters accounts', async () => {
    const admin = await createAdmin({ name: 'Grace Admin' });
    await createUser({ name: 'Ada Lovelace', email: 'ada@example.com' });
    await createUser({ name: 'Alan Turing', email: 'alan@example.com' });
    const client = await signIn(admin);

    const all = await page(client, '/admin/users').expect(200);
    expect(all.text).toContain('3 Konten');
    expect(all.text).toContain('href="/admin/users"');

    const search = await page(client, '/admin/users?q=LOVE').expect(200);
    expect(search.text).toContain('Ada Lovelace');
    expect(search.text).not.toContain('Alan Turing');

    // Regex characters are matched literally.
    const literal = await page(client, '/admin/users?q=.*').expect(200);
    expect(literal.text).toContain('0 Konten');

    const admins = await page(client, '/admin/users?role=admin').expect(200);
    expect(admins.text).toContain('Grace Admin');
    expect(admins.text).not.toContain('Ada Lovelace');

    const invalid = await page(client, '/admin/users?page=-4&role=root').expect(200);
    expect(invalid.text).toContain('3 Konten');
  });

  it('paginates', async () => {
    const admin = await createAdmin();
    await Promise.all(Array.from({ length: 21 }, () => createUser()));
    const client = await signIn(admin);
    const first = await page(client, '/admin/users').expect(200);
    expect(first.text).toContain('Seite 1 von 2');
    expect(first.text).toContain('href="/admin/users?page=2"');
  });

  it('changes name and role, which ends the sessions of that account', async () => {
    const admin = await createAdmin();
    const user = await createUser();
    const userTokens = await tokensFor(user);
    const client = await signIn(admin);
    await new Promise((resolve) => setTimeout(resolve, 1005 - (Date.now() % 1000)));

    const res = await client.submit(
      `/admin/users/${user.id}`,
      { name: 'Renamed User', role: 'admin' },
      `/admin/users/${user.id}`
    );
    expect(res.headers.location).toBe(`/admin/users/${user.id}`);
    const updated = await User.findById(user.id);
    expect(updated).toMatchObject({ name: 'Renamed User', role: 'admin' });
    await request(app).get('/v1/users/profile').set(bearer(userTokens)).expect(401);
    expect(await AuditEvent.exists({ user: user.id, type: 'roleChanged' })).toBeTruthy();

    const invalid = await client.submit(
      `/admin/users/${user.id}`,
      { name: 'x', role: 'root' },
      `/admin/users/${user.id}`
    );
    expect(invalid.headers.location).toBe(`/admin/users/${user.id}`);
    expect((await User.findById(user.id)).name).toBe('Renamed User');
  });

  it('protects administrators from locking themselves out', async () => {
    const admin = await createAdmin();
    const client = await signIn(admin);
    const view = await page(client, `/admin/users/${admin.id}`).expect(200);
    expect(view.text).toContain('disabled');
    expect(view.text).not.toContain(`action="/admin/users/${admin.id}/delete"`);

    await client.submit(`/admin/users/${admin.id}`, { name: admin.name, role: 'user' }, `/admin/users/${admin.id}`);
    expect((await User.findById(admin.id)).role).toBe('admin');
    const csrf = await client.csrfFrom(`/admin/users/${admin.id}`);
    await client.agent
      .post(`/admin/users/${admin.id}/delete`)
      .type('form')
      .send({ _csrf: csrf, confirmEmail: admin.email });
    expect(await User.exists({ _id: admin.id })).toBeTruthy();
  });

  it('deletes an account only after the address is typed again', async () => {
    const admin = await createAdmin();
    const user = await createUser();
    await AuditEvent.create({ user: user.id, type: 'login' });
    const client = await signIn(admin);

    await client.submit(
      `/admin/users/${user.id}/delete`,
      { confirmEmail: 'wrong@example.com' },
      `/admin/users/${user.id}`
    );
    expect(await User.exists({ _id: user.id })).toBeTruthy();

    const res = await client.submit(
      `/admin/users/${user.id}/delete`,
      { confirmEmail: user.email.toUpperCase() },
      `/admin/users/${user.id}`
    );
    expect(res.headers.location).toBe('/admin/users');
    expect(await User.exists({ _id: user.id })).toBeFalsy();
    expect(await AuditEvent.countDocuments({ user: user.id })).toBe(0);
  });

  it('answers unknown and malformed ids with a 404 page', async () => {
    const client = await signIn(await createAdmin());
    await page(client, '/admin/users/64b7f0c2a1b2c3d4e5f60718').expect(404);
    expect((await page(client, '/admin/users/not-an-id')).status).toBe(404);
  });
});

describe('GET /v1/users search', () => {
  it('filters by a case-insensitive substring of name or email', async () => {
    const admin = await createAdmin();
    await createUser({ name: 'Ada Lovelace', email: 'ada@example.com' });
    const headers = bearer(await tokensFor(admin));
    const res = await request(app).get('/v1/users?search=ADA').set(headers).expect(200);
    expect(res.body.results.map((user) => user.email)).toEqual(['ada@example.com']);
    const none = await request(app).get('/v1/users?search=(a%2B)%2B%24').set(headers).expect(200);
    expect(none.body.totalResults).toBe(0);
  });
});
