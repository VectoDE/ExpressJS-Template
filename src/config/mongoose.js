const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./logger');

mongoose.set('strictQuery', true);
// Objects with $-keys in query filters are wrapped in $eq, so user input cannot become an operator.
mongoose.set('sanitizeFilter', true);

const connect = async (url = config.mongoose.url) => {
  await mongoose.connect(url, config.mongoose.options);
  logger.info('Connected to MongoDB');
};

const disconnect = async () => {
  await mongoose.disconnect();
};

module.exports = {
  connect,
  disconnect,
};
