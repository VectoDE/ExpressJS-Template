const config = require('../../src/config/config');
const userService = require('../../src/services/user.service');
const { ensureAuthenticated } = require('../../src/middlewares/viewAuth');

// A signed-in browser session without a store behind it.
const signedInRequest = (createdAt) => ({
  method: 'GET',
  originalUrl: '/dashboard',
  t: (key) => key,
  session: {
    user: { id: '507f1f77bcf86cd799439011' },
    createdAt,
    authenticatedAt: createdAt,
    regenerate(callback) {
      delete this.user;
      callback();
    },
  },
});

describe('ensureAuthenticated', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ends a session older than the absolute limit, even when it was just used', async () => {
    const lookup = jest.spyOn(userService, 'getUserById');
    const req = signedInRequest(Date.now() - config.security.session.absoluteTimeoutMs - 1000);
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    await ensureAuthenticated(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/login');
    expect(req.session.flash).toEqual([{ type: 'warning', text: 'flash.sessionExpired' }]);
    expect(req.session.user).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
