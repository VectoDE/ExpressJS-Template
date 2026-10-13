// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const crypto = require('node:crypto');
const path = require('node:path');
const Joi = require('joi');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true });

const flag = () => Joi.boolean().truthy('true', '1').falsy('false', '0');
const secret = () => Joi.string().min(32).max(512);
const DATABASE_SCHEMES = /^(mongodb(\+srv)?|postgres(ql)?|mysql|mariadb|sqlite|mssql|sqlserver|oracle|d1):/i;
const PLACEHOLDER = /change-?me|changeme|secret|example|placeholder|^(.)\1+$/i;

const withoutTrailingSlash = (url) => {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end -= 1;
  return url.slice(0, end);
};

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
  PORT: Joi.number().port().default(8080),
  // Picks the database, see src/db/index.js. MONGODB_URI and MONGODB_DB_NAME are the names from version 3.0.
  DATABASE_URL: Joi.string().pattern(DATABASE_SCHEMES, 'supported database URL'),
  // Account with the right to change the schema. When set, the app only checks the schema and `npm run migrate`
  // applies changes with this account, so the running app can use one without DDL rights.
  MIGRATION_DATABASE_URL: Joi.string().pattern(DATABASE_SCHEMES, 'supported database URL'),
  MONGODB_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }),
  DATABASE_NAME: Joi.string().pattern(/^[A-Za-z0-9_-]{1,63}$/),
  MONGODB_DB_NAME: Joi.string().pattern(/^[A-Za-z0-9_-]{1,63}$/),
  JWT_SECRET: secret(),
  JWT_ISSUER: Joi.string().max(200).default('expressjs-template'),
  JWT_AUDIENCE: Joi.string().max(200).default('expressjs-template-api'),
  JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().integer().min(1).max(60).default(15),
  JWT_REFRESH_EXPIRATION_DAYS: Joi.number().integer().min(1).max(30).default(7),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),
  CORS_ORIGIN: Joi.string().allow('').default(''),
  SESSION_SECRET: secret(),
  SESSION_NAME: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{1,32}$/)
    .default('sid'),
  SESSION_IDLE_TIMEOUT_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(24 * 60)
    .default(30),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(7 * 24)
    .default(12),
  SESSION_COOKIE_SECURE: flag(),
  TRUST_PROXY: Joi.alternatives(flag(), Joi.number().integer().min(0).max(10)).default(0),
  API_DOCS_ENABLED: flag(),
  RATE_LIMIT_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(24 * 60)
    .default(15),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(10),
  LOGIN_MAX_ATTEMPTS: Joi.number().integer().min(1).max(100).default(5),
  LOGIN_LOCK_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(24 * 60)
    .default(15),
  // database shares the counters between app instances; mongo is the name from version 3.0.
  RATE_LIMIT_STORE: Joi.string().valid('memory', 'database', 'mongo').default('memory'),
  APP_NAME: Joi.string().trim().min(1).max(60).default('Express.js Template'),
  APP_URL: Joi.string().uri({ scheme: ['http', 'https'] }),
  DEFAULT_LOCALE: Joi.string().valid('en', 'de').default('en'),
  ENCRYPTION_KEY: secret(),
  SMTP_URL: Joi.string()
    .uri({ scheme: ['smtp', 'smtps'] })
    .allow('')
    .default(''),
  MAIL_FROM: Joi.string().max(254).default('Express.js Template <no-reply@localhost>'),
  AUTH_REQUIRE_VERIFIED_EMAIL: flag().default(false),
  AUDIT_RETENTION_DAYS: Joi.number().integer().min(1).max(3650).default(180),
  METRICS_TOKEN: Joi.string().min(32).max(512).allow('').default(''),
  MOTION_STYLE: Joi.string().valid('film', 'precise', 'playful', 'calm', 'off').default('film'),
  MOTION_SWITCH: flag().default(true),
  // Public demo (the Cloudflare Worker): e-mails are shown on the page instead of being sent and the settings
  // below may be relaxed. Never set it for a real installation.
  DEMO_MODE: flag().default(false),
  // scrypt cost as a power of two (N = 2^cost). Below 17 only with DEMO_MODE, for the CPU limits of Workers Free.
  PASSWORD_HASH_COST: Joi.number().integer().min(10).max(20).default(17),
}).unknown();

const { value: envVars, error } = envSchema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

const isProduction = envVars.NODE_ENV === 'production';
const corsOrigins = envVars.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Each secret protects something different, so each one must be its own random value.
const SECRET_NAMES = ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY'];

const isDemo = envVars.DEMO_MODE === true;
const DEFAULT_HASH_COST = 17;

const problems = [];
// Demo relaxations need DEMO_MODE in every environment, so they never switch on by accident.
if (!isDemo && envVars.PASSWORD_HASH_COST < DEFAULT_HASH_COST) {
  problems.push(`PASSWORD_HASH_COST below ${DEFAULT_HASH_COST} is only allowed with DEMO_MODE=true`);
}
if (!isDemo && /^d1:/i.test(envVars.DATABASE_URL || '')) {
  problems.push('DATABASE_URL=d1: runs transactions without atomicity and is only allowed with DEMO_MODE=true');
}
if (isProduction) {
  SECRET_NAMES.forEach((name) => {
    if (!envVars[name]) {
      problems.push(`${name} is required in production`);
    } else if (PLACEHOLDER.test(envVars[name])) {
      problems.push(`${name} still looks like a placeholder, generate a random value`);
    }
  });
  const setSecrets = SECRET_NAMES.map((name) => envVars[name]).filter(Boolean);
  if (new Set(setSecrets).size !== setSecrets.length) {
    problems.push(`${SECRET_NAMES.join(', ')} must all be different`);
  }
  if (envVars.METRICS_TOKEN && PLACEHOLDER.test(envVars.METRICS_TOKEN)) {
    problems.push('METRICS_TOKEN still looks like a placeholder, generate a random value');
  }
  if (!envVars.APP_URL) {
    problems.push('APP_URL is required in production, it is used for links in emails');
  } else if (!envVars.APP_URL.startsWith('https://')) {
    problems.push('APP_URL must use https in production');
  }
  if (!envVars.SMTP_URL && !isDemo) {
    problems.push('SMTP_URL is required in production, otherwise password resets and verification emails fail');
  }
  if (corsOrigins.includes('*')) {
    problems.push('CORS_ORIGIN=* is not allowed in production, list the allowed origins');
  }
  if (envVars.SESSION_COOKIE_SECURE === false) {
    problems.push('SESSION_COOKIE_SECURE cannot be disabled in production');
  }
  // The app speaks plain HTTP and only sets its secure session cookie when a trusted proxy reports HTTPS.
  if (!envVars.TRUST_PROXY) {
    problems.push('TRUST_PROXY is required in production: run behind a TLS proxy and set the number of proxies');
  }
}
corsOrigins
  .filter((origin) => origin !== '*')
  .forEach((origin) => {
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
      problems.push(`CORS_ORIGIN entry "${origin}" must be an origin like https://app.example.com`);
    }
  });

if (problems.length) {
  throw new Error(`Insecure configuration:\n- ${problems.join('\n- ')}`);
}

// Outside production a missing secret gets a random one per process. Nothing guessable ever signs tokens.
const ephemeral = [];
const secretOrRandom = (name) => {
  if (envVars[name]) {
    return envVars[name];
  }
  ephemeral.push(name);
  return crypto.randomBytes(48).toString('base64url');
};

const cookieSecure = envVars.SESSION_COOKIE_SECURE ?? isProduction;
const trustProxy = envVars.TRUST_PROXY === true ? 1 : Number(envVars.TRUST_PROXY) || 0;

module.exports = {
  env: envVars.NODE_ENV,
  isProduction,
  port: envVars.PORT,
  // Public demo mode, see DEMO_MODE above and the README section on the Cloudflare demo.
  demo: isDemo,
  ephemeralSecrets: ephemeral,
  cors: {
    origins: corsOrigins,
  },
  database: {
    url: envVars.DATABASE_URL || envVars.MONGODB_URI || 'sqlite:data/app.db',
    // Database name for MongoDB; SQL databases take it from the URL.
    name: envVars.DATABASE_NAME || envVars.MONGODB_DB_NAME || 'expressjs_template',
    migrationUrl: envVars.MIGRATION_DATABASE_URL,
    // Without a separate migration account the app brings the schema up to date itself on start.
    migrateOnStart: !envVars.MIGRATION_DATABASE_URL,
  },
  jwt: {
    secret: secretOrRandom('JWT_SECRET'),
    issuer: envVars.JWT_ISSUER,
    audience: envVars.JWT_AUDIENCE,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  logLevel: envVars.LOG_LEVEL,
  docsEnabled: envVars.API_DOCS_ENABLED ?? !isProduction,
  // Shown in the header, page titles and emails.
  appName: envVars.APP_NAME,
  // Base URL for links in emails. Without a trailing slash.
  appUrl: withoutTrailingSlash(envVars.APP_URL || `http://localhost:${envVars.PORT}`),
  defaultLocale: envVars.DEFAULT_LOCALE,
  // Animation style of the web pages. With the switch on, visitors can pick another style in the footer.
  motion: { style: envVars.MOTION_STYLE, switcher: envVars.MOTION_SWITCH },
  // Key for data encrypted at rest (two-factor secrets). Changing it makes stored secrets unreadable.
  encryptionKey: secretOrRandom('ENCRYPTION_KEY'),
  mail: {
    // Empty outside production: emails are written to the log instead of being sent. In demo mode they are
    // shown to the visitor who triggered them and never sent.
    smtpUrl: envVars.SMTP_URL,
    from: envVars.MAIL_FROM,
  },
  password: {
    // scrypt N as a power of two; 17 (OWASP) unless a demo lowers it.
    hashCost: envVars.PASSWORD_HASH_COST,
  },
  auth: {
    requireVerifiedEmail: envVars.AUTH_REQUIRE_VERIFIED_EMAIL,
    verifyEmailExpirationHours: 24,
    resetPasswordExpirationMinutes: 60,
    twoFactorChallengeMinutes: 5,
  },
  audit: {
    retentionDays: envVars.AUDIT_RETENTION_DAYS,
  },
  metrics: {
    // /metrics is only served when a token is set; scrapers send it as a bearer token.
    token: envVars.METRICS_TOKEN,
  },
  rateLimit: {
    store: envVars.RATE_LIMIT_STORE === 'memory' ? 'memory' : 'database',
    windowMs: envVars.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: envVars.RATE_LIMIT_MAX,
    authMax: envVars.AUTH_RATE_LIMIT_MAX,
  },
  login: {
    maxAttempts: envVars.LOGIN_MAX_ATTEMPTS,
    lockMs: envVars.LOGIN_LOCK_MINUTES * 60 * 1000,
  },
  security: {
    trustProxy,
    session: {
      // The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and Path=/.
      name: cookieSecure ? `__Host-${envVars.SESSION_NAME}` : envVars.SESSION_NAME,
      secret: secretOrRandom('SESSION_SECRET'),
      idleTimeoutMinutes: envVars.SESSION_IDLE_TIMEOUT_MINUTES,
      absoluteTimeoutMs: envVars.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000,
      cookieSecure,
    },
  },
};
