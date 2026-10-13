// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const request = require('supertest');
const app = require('../../src/app');
const { useDatabase, db } = require('../helpers/db');
const { createUser, createAdmin, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();

const asUser = async (factory = createUser) => {
  const user = await factory();
  return { user, headers: bearer(await tokensFor(user)) };
};

describe('GET /v1/users/profile', () => {
  it('returns only public fields of the signed-in user', async () => {
    const { user, headers } = await asUser();
    const res = await request(app).get('/v1/users/profile').set(headers).expect(200);
    expect(Object.keys(res.body.user).sort((a, b) => a.localeCompare(b))).toEqual(
      ['createdAt', 'email', 'id', 'isEmailVerified', 'locale', 'name', 'role', 'twoFactorEnabled', 'updatedAt'].sort(
        (a, b) => a.localeCompare(b)
      )
    );
    expect(res.body.user.id).toBe(user.id);
  });
});

describe('privilege escalation', () => {
  it('a user cannot promote themselves through PATCH /v1/users/:id', async () => {
    const { user, headers } = await asUser();
    await request(app).patch(`/v1/users/${user.id}`).set(headers).send({ role: 'admin' }).expect(403);
    expect((await db.users.findById(user.id)).role).toBe('user');
  });

  it.each([
    ['get', (id) => `/v1/users/${id}`],
    ['delete', (id) => `/v1/users/${id}`],
    ['get', () => '/v1/users'],
    ['post', () => '/v1/users'],
  ])('a user gets 403 for %s %s', async (method, path) => {
    const { user, headers } = await asUser();
    await request(app)[method](path(user.id)).set(headers).send({}).expect(403);
  });

  it('demoting an admin revokes their existing tokens', async () => {
    const { headers: adminHeaders } = await asUser(createAdmin);
    const other = await createAdmin();
    const otherTokens = await tokensFor(other);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await request(app).patch(`/v1/users/${other.id}`).set(adminHeaders).send({ role: 'user' }).expect(200);
    expect((await request(app).get('/v1/users').set(bearer(otherTokens))).status).toBe(401);
  });
});

describe('admin user management', () => {
  it('creates, reads, updates and deletes users', async () => {
    const { headers } = await asUser(createAdmin);
    const created = await request(app)
      .post('/v1/users')
      .set(headers)
      .send({ name: 'New Admin', email: 'new@example.com', password: 'Secure-Enough-2024', role: 'admin' })
      .expect(201);
    const id = created.body.user.id;

    await request(app).get(`/v1/users/${id}`).set(headers).expect(200);
    const updated = await request(app).patch(`/v1/users/${id}`).set(headers).send({ name: 'Renamed' }).expect(200);
    expect(updated.body.user.name).toBe('Renamed');
    await request(app).delete(`/v1/users/${id}`).set(headers).expect(204);
    await request(app).get(`/v1/users/${id}`).set(headers).expect(404);
  });

  it('lists users with pagination and whitelisted sorting only', async () => {
    const { headers } = await asUser(createAdmin);
    await Promise.all([createUser(), createUser(), createUser()]);
    const res = await request(app).get('/v1/users?limit=2&page=1&sortBy=email:asc').set(headers).expect(200);
    expect(res.body).toMatchObject({ page: 1, limit: 2, totalResults: 4, totalPages: 2 });
    expect(res.body.results).toHaveLength(2);

    await request(app).get('/v1/users?sortBy=password:asc').set(headers).expect(400);
    await request(app).get('/v1/users?limit=1000').set(headers).expect(400);
    await request(app).get('/v1/users?role[$ne]=x').set(headers).expect(400);
  });

  it('protects admins from removing or demoting themselves', async () => {
    const { user, headers } = await asUser(createAdmin);
    await request(app).delete(`/v1/users/${user.id}`).set(headers).expect(403);
    expect((await request(app).patch(`/v1/users/${user.id}`).set(headers).send({ role: 'user' })).status).toBe(403);
  });

  it('answers 400 for invalid ids, 404 for unknown ones and 409 for taken emails', async () => {
    const { headers } = await asUser(createAdmin);
    const other = await createUser();
    await request(app).get('/v1/users/not-an-id').set(headers).expect(400);
    await request(app).get('/v1/users/0123456789abcdef01234567').set(headers).expect(404);
    await request(app).patch('/v1/users/0123456789abcdef01234567').set(headers).send({ name: 'Nobody' }).expect(404);
    await request(app).delete('/v1/users/0123456789abcdef01234567').set(headers).expect(404);
    const admin = await createAdmin();
    await request(app).patch(`/v1/users/${admin.id}`).set(headers).send({ email: other.email }).expect(409);
    expect(
      (
        await request(app)
          .post('/v1/users')
          .set(headers)
          .send({ name: 'Copy', email: other.email, password: 'Secure-Enough-2024' })
      ).status
    ).toBe(409);
  });

  it('rejects empty and unknown update fields', async () => {
    const { headers } = await asUser(createAdmin);
    const other = await createUser();
    await request(app).patch(`/v1/users/${other.id}`).set(headers).send({}).expect(400);
    expect(
      (await request(app).patch(`/v1/users/${other.id}`).set(headers).send({ isEmailVerified: true })).status
    ).toBe(400);
  });
});
