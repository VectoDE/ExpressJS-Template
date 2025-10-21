const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const mongoose = require('./config/mongoose');

let server;

const startServer = async () => {
  try {
    await mongoose.connect();
    server = app.listen(config.port, () => {
      logger.info(`🚀 Server listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server: %s', error.message);
    process.exit(1);
  }
};

startServer();

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error('Unexpected error: %s', error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
