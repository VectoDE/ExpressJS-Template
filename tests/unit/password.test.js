const crypto = require('node:crypto');
const { hashPassword, comparePassword, needsRehash, burnPasswordCheck } = require('../../src/utils/password');

describe('password hashing', () => {
  it('stores scrypt hashes with their parameters and a random salt', async () => {
    const first = await hashPassword('Correct-Horse-9-Battery');
    const second = await hashPassword('Correct-Horse-9-Battery');
    expect(first).toMatch(/^scrypt\$131072\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Correct-Horse-9-Battery');
    await expect(comparePassword('Correct-Horse-9-Battery', hash)).resolves.toBe(true);
    await expect(comparePassword('correct-horse-9-battery', hash)).resolves.toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it('still accepts hashes from version 1.x and flags them for an upgrade', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.scryptSync('Legacy-Pass-123', salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
    const legacy = `${salt}:${key}`;
    await expect(comparePassword('Legacy-Pass-123', legacy)).resolves.toBe(true);
    expect(needsRehash(legacy)).toBe(true);
  });

  it.each([
    ['empty value', ''],
    ['garbage', 'not-a-hash'],
    ['short key', 'scrypt$131072$8$1$c2FsdA==$a2V5'],
    ['absurd cost', `scrypt$${2 ** 30}$8$1$c2FsdA==$a2V5`],
    ['undefined', undefined],
  ])('returns false instead of throwing for a malformed hash (%s)', async (label, stored) => {
    await expect(comparePassword('whatever', stored)).resolves.toBe(false);
  });

  it('refuses passwords longer than 128 characters before hashing', async () => {
    await expect(hashPassword('a'.repeat(129))).rejects.toThrow(TypeError);
    await expect(comparePassword('a'.repeat(129), await hashPassword('short-Pass-1!'))).resolves.toBe(false);
  });

  it('does the same work for unknown accounts', async () => {
    await expect(burnPasswordCheck('anything')).resolves.toBe(false);
    await expect(burnPasswordCheck(undefined)).resolves.toBe(false);
  });
});
