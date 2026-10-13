// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const crypto = require('node:crypto');
const httpStatus = require('../utils/httpStatus');
const ApiError = require('../utils/ApiError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SECRET_BYTES = 32;

const csrfError = () => {
  const error = new ApiError(httpStatus.FORBIDDEN, 'Invalid CSRF token');
  error.code = 'EBADCSRFTOKEN';
  return error;
};

const xor = (a, b) => Buffer.from(a.map((byte, i) => byte ^ b[i]));

const sessionSecret = (req) => {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(SECRET_BYTES).toString('base64url');
  }
  return Buffer.from(req.session.csrfSecret, 'base64url');
};

/**
 * Synchronizer token bound to the session. Every rendered token is masked with fresh random
 * bytes, so compressed responses never repeat the same secret (BREACH).
 */
const issueToken = (req) => {
  const secret = sessionSecret(req);
  const mask = crypto.randomBytes(SECRET_BYTES);
  return `${mask.toString('base64url')}.${xor(secret, mask).toString('base64url')}`;
};

const isValidToken = (req, token) => {
  if (!req.session.csrfSecret || typeof token !== 'string' || token.length > 128) {
    return false;
  }
  const [mask, masked] = token.split('.').map((part) => Buffer.from(part, 'base64url'));
  const secret = Buffer.from(req.session.csrfSecret, 'base64url');
  if (!masked || mask.length !== SECRET_BYTES || masked.length !== SECRET_BYTES) {
    return false;
  }
  return crypto.timingSafeEqual(xor(masked, mask), secret);
};

const csrfProtection = (req, res, next) => {
  if (!req.session) {
    return next(new Error('CSRF protection requires a session'));
  }
  req.csrfToken = () => issueToken(req);

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Fetch Metadata: browsers mark cross-site form posts, reject them before looking at the token.
  const site = req.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return next(csrfError());
  }

  const token = req.body?._csrf || req.get('X-CSRF-Token');
  return isValidToken(req, token) ? next() : next(csrfError());
};

module.exports = {
  csrfProtection,
};
