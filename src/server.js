// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const db = require('./db');

const SHUTDOWN_TIMEOUT_MS = 10000;
const PURGE_INTERVAL_MS = 10 * 60 * 1000;
let server;
let shuttingDown = false;

const shutdown = async (reason, exitCode) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('Shutting down (%s)', reason);
  setTimeout(() => process.exit(exitCode || 1), SHUTDOWN_TIMEOUT_MS).unref();
  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeIdleConnections();
      });
    }
    await db.disconnect();
  } catch (error) {
    logger.error('Error during shutdown: %s', error.message);
    process.exit(1);
  }
  process.exit(exitCode);
};

const start = async () => {
  if (config.ephemeralSecrets.length) {
    logger.warn('%s not set, using random values for this process only', config.ephemeralSecrets.join(' and '));
  }
  await db.connect();
  logger.info('Connected to the database (%s)', db.dialect);
  // Expired tokens, sessions and rate-limit windows and old activity entries are removed in the background.
  // MongoDB does this with TTL indexes; SQL databases need the sweep.
  const purge = () =>
    db
      .purgeExpired(new Date(), new Date(Date.now() - config.audit.retentionDays * 24 * 60 * 60 * 1000))
      .catch((error) => logger.error('Removing expired records failed: %s', error.message));
  void purge();
  setInterval(purge, PURGE_INTERVAL_MS).unref();
  server = app.listen(config.port, () => logger.info('Server listening on port %d', config.port));
  // Slow clients cannot hold sockets open forever (slowloris).
  server.headersTimeout = 20000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
};

start().catch((error) => {
  logger.error('Failed to start server: %s', error.message);
  process.exit(1);
});

process.on('SIGTERM', () => void shutdown('SIGTERM', 0));
process.on('SIGINT', () => void shutdown('SIGINT', 0));
// After an unexpected error the process state is unknown; stop cleanly and let the supervisor restart it.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception: %s', error.stack || error.message);
  void shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection: %s', reason instanceof Error ? reason.stack : JSON.stringify(reason));
  void shutdown('unhandledRejection', 1);
});
