const { createLogger, format, transports } = require('winston');
const config = require('./config');

const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.message, stack: info.stack });
  }
  return info;
});

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    enumerateErrorFormat(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.printf(({ timestamp, level, message, stack, ...rest }) => {
      const payload = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      return stack
        ? `${timestamp} ${level}: ${message}\n${stack}${payload}`
        : `${timestamp} ${level}: ${message}${payload}`;
    })
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
