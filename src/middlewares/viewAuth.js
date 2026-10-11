const config = require('../config/config');
const userService = require('../services/user.service');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const { addFlashMessage } = require('../utils/flash');
const { roleRights } = require('../config/roles');

const endSession = (req, res, key) =>
  req.session.regenerate((error) => {
    if (error) {
      return res.redirect('/login');
    }
    addFlashMessage(req, { type: 'warning', text: req.t(key) });
    return res.redirect('/login');
  });

/**
 * Every protected request reloads the account. A deleted account, a changed password, email or role,
 * or a session older than the absolute limit ends the session.
 */
const ensureAuthenticated = async (req, res, next) => {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    if (req.session && req.method === 'GET') {
      req.session.returnTo = req.originalUrl;
    }
    addFlashMessage(req, { type: 'warning', text: req.t('flash.loginRequired') });
    return res.redirect('/login');
  }

  if (Date.now() - (req.session.createdAt || 0) > config.security.session.absoluteTimeoutMs) {
    return endSession(req, res, 'flash.sessionExpired');
  }

  const user = await userService.getUserById(sessionUser.id);
  if (!user || (req.session.authenticatedAt || 0) < user.credentialsChangedAt.getTime()) {
    return endSession(req, res, 'flash.signInAgain');
  }

  req.currentUserDoc = user;
  req.session.user = userService.toUserResponse(user);
  res.locals.currentUser = req.session.user;
  res.locals.isAuthenticated = true;
  return next();
};

// Browser counterpart of auth(...rights) for the API. Runs after ensureAuthenticated.
const requireRights =
  (...rights) =>
  (req, res, next) => {
    const granted = roleRights.get(req.currentUserDoc?.role) || [];
    if (!rights.every((right) => granted.includes(right))) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action'));
    }
    return next();
  };

const ensureGuest = (req, res, next) => {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }
  return next();
};

module.exports = {
  ensureAuthenticated,
  requireRights,
  ensureGuest,
};
