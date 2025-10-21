const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const logger = require('../config/logger');

const isWebRequest = (req) => {
  const acceptsHtml = req.accepts('html');
  if (!acceptsHtml) {
    return false;
  }
  return !req.originalUrl.startsWith('/v1') && !req.originalUrl.startsWith('/docs');
};

const renderErrorView = (res, view, statusCode, message, stack) => {
  res.status(statusCode);
  return res.render(view, {
    statusCode,
    message,
    stack,
  });
};

const notFound = (req, res, next) => {
  if (isWebRequest(req)) {
    return renderErrorView(res, 'error/404', httpStatus.NOT_FOUND, 'The requested page could not be found.');
  }
  return next(new ApiError(httpStatus.NOT_FOUND, `Route ${req.originalUrl} not found`));
};

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || error.status || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || httpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || httpStatus[statusCode];

  if (config.env === 'development') {
    logger.error(err);
  } else {
    logger.error(`${statusCode} - ${message}`);
  }

  if (err.code === 'EBADCSRFTOKEN') {
    const csrfMessage = 'Security verification failed. Please refresh the page and try again.';
    if (isWebRequest(req)) {
      return renderErrorView(res, 'error/500', httpStatus.FORBIDDEN, csrfMessage);
    }
    return res.status(httpStatus.FORBIDDEN).json({
      code: httpStatus.FORBIDDEN,
      message: csrfMessage,
    });
  }

  if (isWebRequest(req)) {
    const stack = config.env === 'development' ? err.stack : undefined;
    return renderErrorView(res, 'error/500', statusCode, message, stack);
  }

  const response = {
    code: statusCode,
    message,
  };

  if (config.env === 'development' && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  notFound,
  errorConverter,
  errorHandler,
};
