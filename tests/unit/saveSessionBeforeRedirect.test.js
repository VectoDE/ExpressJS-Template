// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const saveSessionBeforeRedirect = require('../../src/middlewares/saveSessionBeforeRedirect');

const setup = (session, events) => {
  const req = { session };
  const res = { redirect: (...args) => events.push(['redirect', ...args]) };
  const next = jest.fn();
  saveSessionBeforeRedirect(req, res, next);
  return { req, res, next, events };
};

const sessionWith = (data, events, error = null) => ({
  ...data,
  cookie: { maxAge: 1000 },
  save(callback) {
    events.push(['save']);
    setImmediate(() => callback(error));
  },
});

describe('saveSessionBeforeRedirect', () => {
  it('stores a changed session before the redirect is sent', async () => {
    const events = [];
    const { req, res, next } = setup(sessionWith({ csrf: 'a' }, events), events);
    // The handler changes the session after the middleware ran.
    req.session.pendingLogin = { userId: '1' };
    res.redirect('/login/2fa');
    expect(events).toEqual([['save']]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(events).toEqual([['save'], ['redirect', '/login/2fa']]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('redirects right away when nothing changed', () => {
    const events = [];
    const original = [];
    const req = { session: sessionWith({ csrf: 'a' }, events) };
    const res = { redirect: (...args) => original.push(args) };
    saveSessionBeforeRedirect(req, res, jest.fn());
    res.redirect('/');
    expect(events).toEqual([]);
    expect(original).toEqual([['/']]);
  });

  it('redirects without a session', () => {
    const original = [];
    const req = {};
    const res = { redirect: (...args) => original.push(args) };
    saveSessionBeforeRedirect(req, res, jest.fn());
    res.redirect(303, '/');
    expect(original).toEqual([[303, '/']]);
  });

  it('passes a store error on instead of redirecting', async () => {
    const events = [];
    const original = [];
    const failure = new Error('store down');
    const req = { session: sessionWith({}, events, failure) };
    const res = { redirect: (...args) => original.push(args) };
    const next = jest.fn();
    saveSessionBeforeRedirect(req, res, next);
    req.session.flash = ['x'];
    res.redirect('/');
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenLastCalledWith(failure);
    expect(original).toEqual([]);
  });

  it('redirects after the save completed', async () => {
    const events = [];
    const original = [];
    const req = { session: sessionWith({}, events) };
    const res = { redirect: (...args) => original.push(args) };
    saveSessionBeforeRedirect(req, res, jest.fn());
    req.session.user = { id: '1' };
    res.redirect('/dashboard');
    expect(original).toEqual([]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(original).toEqual([['/dashboard']]);
  });
});
