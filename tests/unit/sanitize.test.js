// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { clean, sanitize } = require('../../src/middlewares/sanitize');

describe('sanitize', () => {
  it('removes MongoDB operators, dotted keys and prototype keys at every level', () => {
    const input = JSON.parse(
      '{"email":{"$gt":""},"a.b":1,"__proto__":{"admin":true},"nested":{"constructor":1,"ok":[{"$where":"x","v":2}]},"keep":"yes"}'
    );
    expect(clean(input)).toEqual({ email: {}, nested: { ok: [{ v: 2 }] }, keep: 'yes' });
    expect({}.admin).toBeUndefined();
  });

  it('cuts structures that are nested too deeply', () => {
    let deep = { v: 1 };
    for (let i = 0; i < 20; i += 1) {
      deep = { d: deep };
    }
    expect(JSON.stringify(clean(deep))).not.toContain('"v":1');
  });

  it('works as middleware and leaves other values alone', () => {
    const req = { body: { $ne: 1, name: 'x' } };
    const next = jest.fn();
    sanitize(req, {}, next);
    expect(req.body).toEqual({ name: 'x' });
    expect(next).toHaveBeenCalledWith();
    expect(clean('text')).toBe('text');
  });
});
