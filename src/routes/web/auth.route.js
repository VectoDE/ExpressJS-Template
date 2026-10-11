const express = require('express');
const { ensureAuthenticated, ensureGuest } = require('../../middlewares/viewAuth');
const { authLimiter, emailLimiter } = require('../../middlewares/rateLimit');
const authController = require('../../controllers/web/auth.controller');

const router = express.Router();

router
  .route('/login')
  .get(ensureGuest, authController.renderLogin)
  .post(authLimiter, ensureGuest, authController.handleLogin);
router
  .route('/login/2fa')
  .get(ensureGuest, authController.renderTwoFactor)
  .post(authLimiter, ensureGuest, authController.handleTwoFactor);
router
  .route('/register')
  .get(ensureGuest, authController.renderRegister)
  .post(authLimiter, ensureGuest, authController.handleRegister);
router.post('/logout', ensureAuthenticated, authController.handleLogout);

router
  .route('/forgot-password')
  .get(ensureGuest, authController.renderForgotPassword)
  .post(emailLimiter, ensureGuest, authController.handleForgotPassword);
router
  .route('/reset-password')
  .get(authController.renderResetPassword)
  .post(authLimiter, authController.handleResetPassword);
router.route('/verify-email').get(authController.renderVerifyEmail).post(authLimiter, authController.handleVerifyEmail);

module.exports = router;
