const { rateLimit } = require('express-rate-limit');
const config = require('../config/config');
const httpStatus = require('../utils/httpStatus');
const ApiError = require('../utils/ApiError');
const db = require('../db');
const DatabaseRateLimitStore = require('../db/rateLimitStore');

// The error handler answers with JSON for the API and an HTML page for the browser.
const handler = (req, res, next) => {
  next(new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Too many requests, please try again later.'));
};

// RATE_LIMIT_STORE=database shares the counters between instances; the default keeps them in memory.
const storeFor = (prefix) =>
  config.rateLimit.store === 'database' ? { store: new DatabaseRateLimitStore({ db, prefix }) } : {};

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
  ...storeFor('api:'),
});

// Browser forms answer failures with a redirect too, so a failure is recognised by the error message it leaves
// for the next page.
const leftErrorMessage = (req) =>
  Array.isArray(req.session?.flash) && req.session.flash.some((message) => message.type === 'error');

// Sign-in, sign-up, password, code and token endpoints: few failed attempts per IP. Successful requests do not count.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400 && !leftErrorMessage(req),
  handler,
  ...storeFor('auth:'),
});

// Endpoints that send an email answer the same way whether or not a mail went out, so every request counts.
// Without this, anyone could flood an inbox with reset or verification mails.
const emailLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
  ...storeFor('email:'),
});

module.exports = {
  apiLimiter,
  authLimiter,
  emailLimiter,
};
