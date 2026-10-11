const i18n = require('../i18n');

/**
 * Sets req.locale, req.t and the matching template locals. Called once from the browser's
 * Accept-Language for every request, and again in the web router once the session is known,
 * because a chosen language (session or account) beats the browser setting.
 */
const applyLocale = (req, res, locale) => {
  const { locale: resolved, t, section } = i18n.forLocale(locale);
  req.locale = resolved;
  req.t = t;
  Object.assign(res.locals, { locale: resolved, t, section, locales: i18n.SUPPORTED });
};

const localeFromRequest = (req) => {
  const preferred = req.session?.locale || req.session?.user?.locale;
  return i18n.isSupported(preferred) ? preferred : i18n.negotiate(req.get('accept-language'));
};

const i18nMiddleware = (req, res, next) => {
  applyLocale(req, res, localeFromRequest(req));
  next();
};

module.exports = { i18nMiddleware, applyLocale, localeFromRequest };
