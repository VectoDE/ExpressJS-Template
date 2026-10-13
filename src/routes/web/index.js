// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const express = require('express');
const { csrfProtection } = require('../../middlewares/csrf');
const viewLocals = require('../../middlewares/viewLocals');
const { addFlashMessage } = require('../../utils/flash');
const siteRoute = require('./site.route');
const authRoute = require('./auth.route');
const accountRoute = require('./account.route');
const adminRoute = require('./admin.route');

const router = express.Router();

router.use(csrfProtection);
router.use(viewLocals);

router.use('/', siteRoute);
router.use('/', authRoute);
router.use('/account', accountRoute);
router.use('/admin', adminRoute);

// A failed CSRF check sends the user back to the form it came from, never to an address taken from headers.
const FORM_PAGES = [
  [/^\/(login|login\/2fa|register|forgot-password)$/, (path) => path],
  [/^\/reset-password$/, () => '/forgot-password'],
  [/^\/verify-email$/, () => '/login'],
  [/^\/account\//, () => '/dashboard'],
  [/^\/admin\/users\/[0-9a-f]{24}(\/delete)?$/, (path) => path.replace(/\/delete$/, '')],
];

const formPageFor = (path) => {
  const match = FORM_PAGES.find(([pattern]) => pattern.test(path));
  return match ? match[1](path) : '/';
};

router.use((err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN' || !req.session) {
    return next(err);
  }
  addFlashMessage(req, { type: 'error', text: req.t('flash.formExpired') });
  return res.redirect(formPageFor(req.path));
});

module.exports = router;
