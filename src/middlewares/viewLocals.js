const { consumeFlashMessages, consumeInput } = require('../utils/flash');
const { applyLocale, localeFromRequest } = require('./i18n');
const { roleRights } = require('../config/roles');

/**
 * Values every template relies on, for a visitor without session. Set for every request, so error pages
 * rendered outside the web router (404, body-parser errors) can always use the shared layout.
 */
const viewDefaults = (req, res, next) => {
  applyLocale(req, res, localeFromRequest(req));
  Object.assign(res.locals, {
    app: req.app.locals.app,
    docsEnabled: req.app.locals.docsEnabled,
    currentUser: null,
    isAuthenticated: false,
    isAdmin: false,
    currentPath: req.path,
    // Where the language switch returns to: the current page, or home after a form post.
    returnTo: req.method === 'GET' ? req.originalUrl : '/',
    requestId: req.id,
    roleLabel: (role) => res.locals.t(`roles.${role}`),
    csrfToken: () => '',
    flash: [],
    old: {},
  });
  next();
};

const canManageUsers = (user) => Boolean(user && (roleRights.get(user.role) || []).includes('manageUsers'));

// Session-dependent values for the browser routes. ensureAuthenticated refreshes currentUser on protected pages.
const viewLocals = (req, res, next) => {
  applyLocale(req, res, localeFromRequest(req));
  res.locals.currentUser = req.session.user || null;
  res.locals.isAuthenticated = Boolean(res.locals.currentUser);
  res.locals.isAdmin = canManageUsers(res.locals.currentUser);
  // A function, so the CSRF secret is only created for pages that actually render a form.
  res.locals.csrfToken = () => req.csrfToken();
  res.locals.flash = consumeFlashMessages(req);
  res.locals.old = consumeInput(req);
  next();
};

module.exports = viewLocals;
module.exports.viewDefaults = viewDefaults;
module.exports.canManageUsers = canManageUsers;
