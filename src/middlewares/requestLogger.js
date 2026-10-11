const morgan = require('morgan');
const logger = require('../config/logger');
const config = require('../config/config');
const { redactUrl } = require('../utils/redact');

const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

const skip = () => config.env === 'test';

morgan.token('id', (req) => req.id || '-');
// Tokens from email links are replaced, so the access log never holds a usable reset or verification link.
morgan.token('safe-url', (req) => redactUrl(req.originalUrl || req.url));

const requestLogger = morgan('[:id] :method :safe-url :status :res[content-length] - :response-time ms', {
  stream,
  skip,
});

module.exports = requestLogger;
