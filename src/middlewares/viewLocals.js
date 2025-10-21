const { consumeFlashMessages } = require('../utils/flash');

const viewLocals = (req, res, next) => {
  res.locals.app = req.app.locals.app;
  res.locals.currentUser = req.session ? req.session.user || null : null;
  res.locals.isAuthenticated = Boolean(res.locals.currentUser);
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
  res.locals.flash = consumeFlashMessages(req);
  next();
};

module.exports = viewLocals;
