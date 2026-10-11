const express = require('express');
const { ensureAuthenticated } = require('../../middlewares/viewAuth');
const siteController = require('../../controllers/web/site.controller');
const accountController = require('../../controllers/web/account.controller');

const router = express.Router();

router.get('/', siteController.renderHome);
router.get('/security', siteController.renderSecurity);
router.get('/privacy', siteController.renderPrivacy);
router.get('/imprint', siteController.renderImprint);
router.get('/dashboard', ensureAuthenticated, accountController.renderDashboard);
router.get('/language/:locale', accountController.handleLanguage);

module.exports = router;
