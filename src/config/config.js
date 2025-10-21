const path = require('path');
const Joi = require('joi');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
  PORT: Joi.number().default(8080),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .default('mongodb://127.0.0.1:27017/expressjs_template'),
  MONGODB_DB_NAME: Joi.string().default('expressjs_template'),
  JWT_SECRET: Joi.string().min(32).default('change-me-change-me-change-me-change'),
  JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30),
  JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),
  CORS_ORIGIN: Joi.string().default('*'),
  SESSION_SECRET: Joi.string().min(32).default('change-me-change-me-change-me-change'),
  SESSION_NAME: Joi.string().default('sid'),
  SESSION_IDLE_TIMEOUT_MINUTES: Joi.number().default(30),
  SESSION_COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(false),
  TRUST_PROXY: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(false),
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env, {
  abortEarly: false,
});

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

const corsOrigins = envVars.CORS_ORIGIN.split(',').map((origin) => origin.trim());

const contentSecurityPolicy = {
  useDefaults: true,
  directives: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'form-action': ["'self'"],
  },
};

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  cors: {
    origins: corsOrigins,
  },
  mongoose: {
    url: envVars.MONGODB_URI,
    options: {
      dbName: envVars.MONGODB_DB_NAME,
      autoIndex: envVars.NODE_ENV !== 'production',
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  logLevel: envVars.LOG_LEVEL,
  security: {
    trustProxy: envVars.TRUST_PROXY,
    session: {
      name: envVars.SESSION_NAME,
      secret: envVars.SESSION_SECRET,
      idleTimeoutMinutes: envVars.SESSION_IDLE_TIMEOUT_MINUTES,
      cookieSecure: envVars.SESSION_COOKIE_SECURE,
    },
    csp: contentSecurityPolicy,
  },
};
