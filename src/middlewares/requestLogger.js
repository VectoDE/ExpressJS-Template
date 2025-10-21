const morgan = require('morgan');
const logger = require('../config/logger');
const config = require('../config/config');

const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

const skip = () => config.env === 'test';

const requestLogger = morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream,
  skip,
});

module.exports = requestLogger;
