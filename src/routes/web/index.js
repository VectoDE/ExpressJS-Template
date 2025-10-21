const express = require('express');
const csurf = require('csurf');
const { ensureAuthenticated, ensureGuest } = require('../../middlewares/viewAuth');
const viewLocals = require('../../middlewares/viewLocals');
const siteController = require('../../controllers/web/site.controller');
const authController = require('../../controllers/web/auth.controller');
const { addFlashMessage } = require('../../utils/flash');

const router = express.Router();
const csrfProtection = csurf();

router.use(csrfProtection);
router.use(viewLocals);

router.get('/', siteController.renderHome);
router.get('/security', siteController.renderSecurity);
router.get('/privacy', siteController.renderPrivacy);
router.get('/dashboard', ensureAuthenticated, siteController.renderDashboard);

router.get('/login', ensureGuest, authController.renderLogin);
router.post('/login', ensureGuest, authController.handleLogin);
router.get('/register', ensureGuest, authController.renderRegister);
router.post('/register', ensureGuest, authController.handleRegister);
router.post('/logout', ensureAuthenticated, authController.handleLogout);

router.use((err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }
  addFlashMessage(req, {
    type: 'error',
    text: 'Deine Sitzung ist abgelaufen. Bitte versuche es erneut.',
  });
  const fallback = '/';
  const referrer = req.get('Referrer');
  return res.redirect(referrer || fallback);
});

module.exports = router;
