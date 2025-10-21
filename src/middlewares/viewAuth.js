const { addFlashMessage } = require('../utils/flash');

const ensureAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.session) {
    req.session.returnTo = req.originalUrl;
  }
  addFlashMessage(req, {
    type: 'warning',
    text: 'Bitte melde dich an, um fortzufahren.',
  });
  return res.redirect('/login');
};

const ensureGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  return next();
};

module.exports = {
  ensureAuthenticated,
  ensureGuest,
};
