const MongoRateLimitStore = require('../../src/utils/mongoRateLimitStore');
const { useDatabase } = require('../helpers/db');

useDatabase();

const storeWith = (windowMs) => {
  const store = new MongoRateLimitStore({ prefix: 'test:' });
  store.init({ windowMs });
  return store;
};

describe('MongoRateLimitStore', () => {
  it('counts hits per key inside one window', async () => {
    const store = storeWith(60000);
    const first = await store.increment('1.2.3.4');
    const second = await store.increment('1.2.3.4');
    const other = await store.increment('5.6.7.8');
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(other.totalHits).toBe(1);
    expect(second.resetTime.getTime()).toBe(first.resetTime.getTime());
    expect(first.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not lose hits under parallel requests', async () => {
    const store = storeWith(60000);
    await Promise.all(Array.from({ length: 25 }, () => store.increment('burst')));
    expect((await store.increment('burst')).totalHits).toBe(26);
  });

  it('starts a new window once the old one has ended', async () => {
    const store = storeWith(50);
    await store.increment('short');
    await store.increment('short');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await store.increment('short')).totalHits).toBe(1);
  });

  it('supports decrement and reset', async () => {
    const store = storeWith(60000);
    await store.increment('key');
    await store.increment('key');
    await store.decrement('key');
    expect((await store.increment('key')).totalHits).toBe(2);
    await store.resetKey('key');
    expect((await store.increment('key')).totalHits).toBe(1);
  });

  it('shares counters between store instances, like between app instances', async () => {
    const a = storeWith(60000);
    const b = storeWith(60000);
    await a.increment('shared');
    expect((await b.increment('shared')).totalHits).toBe(2);
    expect(a.localKeys).toBe(false);
  });
});
