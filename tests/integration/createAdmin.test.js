const { createOrPromote } = require('../../scripts/create-admin');
const { useDatabase, db } = require('../helpers/db');
const { PASSWORD, createUser } = require('../helpers/fixtures');

useDatabase();

const askPassword = async () => PASSWORD;

describe('npm run create-admin', () => {
  it('creates a verified administrator when the email is new', async () => {
    const result = await createOrPromote({ name: 'Root Admin', email: ' Root@Example.com ', askPassword });
    expect(result).toBe('created');
    expect(await db.users.findByEmail('root@example.com')).toMatchObject({ role: 'admin', isEmailVerified: true });
  });

  it('promotes a verified account and ends its sessions', async () => {
    const user = await createUser({ isEmailVerified: true });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await createOrPromote({ email: user.email, askPassword })).toBe('promoted');
    const stored = await db.users.findById(user.id);
    expect(stored.role).toBe('admin');
    expect(stored.credentialsChangedAt.getTime()).toBeGreaterThan(user.credentialsChangedAt.getTime());
  });

  it('refuses to promote an account whose email address is not verified', async () => {
    const user = await createUser({ isEmailVerified: false });
    await expect(createOrPromote({ email: user.email, askPassword })).rejects.toThrow('has not verified');
    expect((await db.users.findById(user.id)).role).toBe('user');
  });

  it('promotes an unverified account with --force', async () => {
    const user = await createUser({ isEmailVerified: false });
    expect(await createOrPromote({ email: user.email, force: true, askPassword })).toBe('promoted');
    expect((await db.users.findById(user.id)).role).toBe('admin');
  });

  it('leaves an administrator as it is', async () => {
    const user = await createUser({ role: 'admin', isEmailVerified: true });
    expect(await createOrPromote({ email: user.email, askPassword })).toBe('already');
  });

  it('rejects an invalid email, a short name and a weak password', async () => {
    await expect(createOrPromote({ name: 'Admin', email: 'not-an-email', askPassword })).rejects.toThrow(
      'not a valid email'
    );
    await expect(createOrPromote({ name: 'A', email: 'a@example.com', askPassword })).rejects.toThrow('3 to 120');
    await expect(
      createOrPromote({ name: 'Admin', email: 'a@example.com', askPassword: async () => 'short' })
    ).rejects.toThrow();
    expect(await db.users.count()).toBe(0);
  });
});
