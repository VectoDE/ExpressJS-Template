const express = require('express');
const { ensureAuthenticated } = require('../../middlewares/viewAuth');
const { authLimiter, emailLimiter } = require('../../middlewares/rateLimit');
const accountController = require('../../controllers/web/account.controller');

// Self-service for signed-in users. Every form that checks a password or code shares the auth rate limit.
const router = express.Router();

router.use(ensureAuthenticated);

router.get('/export', accountController.downloadExport);
router.post('/profile', authLimiter, accountController.handleProfile);
router.post('/password', authLimiter, accountController.handlePassword);
router.post('/verification', emailLimiter, accountController.handleResendVerification);
router.post('/2fa/setup', authLimiter, accountController.handleTwoFactorSetup);
router.post('/2fa/enable', authLimiter, accountController.handleTwoFactorEnable);
router.post('/2fa/disable', authLimiter, accountController.handleTwoFactorDisable);
router.post('/2fa/recovery-codes', authLimiter, accountController.handleRecoveryCodes);
router.post('/sessions/revoke-all', authLimiter, accountController.handleRevokeAllSessions);
router.post('/sessions/:sessionId/revoke', accountController.handleRevokeSession);
router.post('/delete', authLimiter, accountController.handleDelete);

module.exports = router;
