// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const logger = require('../config/logger');
const { redactUrl, oneLine } = require('../utils/redact');
const i18n = require('../i18n');

const CSRF_MESSAGE = 'Security verification failed. Please reload the page and try again.';

const isWebRequest = (req) => {
  if (
    req.originalUrl.startsWith('/v1') ||
    req.originalUrl.startsWith('/docs') ||
    req.originalUrl.startsWith('/health') ||
    req.originalUrl.startsWith('/metrics')
  ) {
    return false;
  }
  return req.accepts(['json', 'html']) === 'html';
};

// Browser error pages show a fixed text per status; API messages and internals stay out of the HTML.
const errorPage = (res, statusCode) => {
  const pages = (res.locals.section || i18n.forLocale().section)('errorPages');
  return pages[statusCode] || pages[statusCode >= 500 ? 500 : 400];
};

const renderErrorView = (res, statusCode) => {
  const page = errorPage(res, statusCode);
  res.status(statusCode);
  return res.render('error/error', { title: page.heading, statusCode, page }, (renderError, html) => {
    if (renderError) {
      // Never fall through to Express' default page, which would print the template error and file paths.
      logger.error('Error page could not be rendered: %s', renderError.message);
      return res.type('text/plain').send(`${page.heading}. ${page.text}`);
    }
    return res.send(html);
  });
};

const notFound = (req, res, next) => {
  if (isWebRequest(req)) {
    return renderErrorView(res, httpStatus.NOT_FOUND);
  }
  return next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
};

/**
 * Turns every error into an ApiError. Only messages that are safe for clients survive:
 * our own operational errors and body-parser errors flagged with `expose`.
 * Everything else becomes a generic 500, so driver messages or connection strings never leak.
 */
const errorConverter = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return next(err);
  }
  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  let message = httpStatus.message(statusCode);

  if (err.code === 11000) {
    statusCode = httpStatus.CONFLICT;
    message = 'Resource already exists';
  } else if (err.name === 'CastError' || err.name === 'ValidationError') {
    statusCode = httpStatus.BAD_REQUEST;
    message = 'Invalid request data';
  } else if (err.expose && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    statusCode = err.status;
    message = err.message;
  }
  const error = new ApiError(statusCode, message, statusCode < 500, err.stack);
  error.code = err.code;
  error.cause = err;
  return next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  const message = err.isOperational ? err.message : httpStatus.message(statusCode);
  // Stack traces only go to the log, in every environment; clients get the request id to quote instead.
  const line = oneLine(`${req.method} ${redactUrl(req.originalUrl)} -> ${statusCode}`);
  if (statusCode >= 500) {
    logger.error('[%s] %s: %s', req.id, line, oneLine((err.cause || err).stack || err.message));
  } else {
    logger.warn('[%s] %s: %s', req.id, line, oneLine(err.message));
  }

  if (res.headersSent) {
    return req.socket.destroy();
  }

  if (err.code === 'EBADCSRFTOKEN') {
    if (isWebRequest(req)) {
      return renderErrorView(res, httpStatus.FORBIDDEN);
    }
    return res
      .status(httpStatus.FORBIDDEN)
      .json({ code: httpStatus.FORBIDDEN, message: CSRF_MESSAGE, requestId: req.id });
  }

  if (isWebRequest(req)) {
    return renderErrorView(res, statusCode);
  }

  // The request id lets support match a client report to the server log without exposing anything else.
  return res.status(statusCode).json({ code: statusCode, message, requestId: req.id });
};

module.exports = {
  notFound,
  errorConverter,
  errorHandler,
};
