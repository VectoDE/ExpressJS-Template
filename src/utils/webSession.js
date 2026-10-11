const userService = require('../services/user.service');
const { addFlashMessage } = require('./flash');

const regenerate = (req) =>
  new Promise((resolve, reject) => {
    // A language chosen before the switch survives it; everything else starts empty.
    const { locale } = req.session;
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      if (locale) {
        req.session.locale = locale;
      }
      resolve();
    });
  });

const save = (req) =>
  new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));

/**
 * Starts a fresh browser session for a user: new session id (no session fixation), public profile only.
 * Used after sign-in and after a credential change, so the current browser stays signed in while
 * every older session is rejected by ensureAuthenticated.
 */
const startSession = async (req, user, flash) => {
  await regenerate(req);
  const now = Date.now();
  req.session.user = userService.toUserResponse(user);
  req.session.authenticatedAt = now;
  req.session.createdAt = now;
  if (flash) {
    addFlashMessage(req, flash);
  }
  await save(req);
};

// New anonymous session, for example after a password reset, so nothing from before carries over.
const resetSession = async (req, flash) => {
  await regenerate(req);
  if (flash) {
    addFlashMessage(req, flash);
  }
  await save(req);
};

// Ends the session and removes the cookie with the same attributes it was set with.
const endSession = (req, res) =>
  new Promise((resolve, reject) => {
    const { cookie } = req.session;
    req.session.destroy((destroyError) => {
      if (destroyError) {
        reject(destroyError);
        return;
      }
      res.clearCookie(req.app.locals.sessionCookieName, {
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      });
      resolve();
    });
  });

module.exports = { startSession, resetSession, endSession };
