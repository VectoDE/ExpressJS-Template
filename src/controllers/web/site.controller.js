const config = require('../../config/config');

// Security headers the home page lists with the values this very response carries.
const SHOWN_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cache-control',
];

const responseHeaders = (res) =>
  SHOWN_HEADERS.map((name) => ({ name, value: res.getHeader(name) })).filter((header) => header.value !== undefined);

// Messages for pages reached after the session was destroyed, where no flash can be stored.
const STATUS_FLASH = {
  signedOut: 'flash.signedOut',
  deleted: 'flash.deleted',
};

const renderHome = (req, res) => {
  Object.entries(STATUS_FLASH).forEach(([param, key]) => {
    if (req.query[param] === '1') {
      res.locals.flash = [...res.locals.flash, { type: 'success', text: req.t(key) }];
    }
  });
  res.render('pages/site/home', { title: null, headers: responseHeaders(res) });
};

// Long-form pages: the text lives per language in views/content/<locale>/.
const contentPage = (page, titleKey) => (req, res) => {
  res.render('pages/site/content', { title: req.t(titleKey), page, retentionDays: config.audit.retentionDays });
};

module.exports = {
  renderHome,
  renderSecurity: contentPage('security', 'nav.security'),
  renderPrivacy: contentPage('privacy', 'nav.privacy'),
  renderImprint: contentPage('imprint', 'nav.imprint'),
};
