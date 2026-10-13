// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { createLogger, format, transports } = require('winston');
const config = require('./config');

const enumerateErrorFormat = format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.message, stack: info.stack });
  }
  return info;
});

// Request data ends up in log lines; escaping CR/LF stops forged log entries.
const neutralizeNewlines = format((info) => {
  if (typeof info.message === 'string') {
    Object.assign(info, { message: info.message.replaceAll('\r', String.raw`\r`).replaceAll('\n', String.raw`\n`) });
  }
  return info;
});

const readable = format.printf(({ timestamp, level, message, stack, ...rest }) => {
  const payload = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  // Winston passes the stack as a string; anything else is serialised instead of printing [object Object].
  const trace = typeof stack === 'string' ? stack : JSON.stringify(stack);
  return stack
    ? `${timestamp} ${level}: ${message}\n${trace}${payload}`
    : `${timestamp} ${level}: ${message}${payload}`;
});

const logger = createLogger({
  level: config.logLevel,
  silent: config.env === 'test',
  format: format.combine(
    enumerateErrorFormat(),
    format.errors({ stack: true }),
    format.splat(),
    neutralizeNewlines(),
    format.timestamp(),
    config.isProduction ? format.json() : readable
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
