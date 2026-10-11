const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const session = require('express-session');
const crypto = require('node:crypto');
const { MongoStore, createWebCryptoAdapter } = require('connect-mongo');
const config = require('./config/config');
const requestId = require('./middlewares/requestId');
const saveSessionBeforeRedirect = require('./middlewares/saveSessionBeforeRedirect');
const requestLogger = require('./middlewares/requestLogger');
const metrics = require('./utils/metrics');
const { sanitize } = require('./middlewares/sanitize');
const { apiLimiter } = require('./middlewares/rateLimit');
const { viewDefaults } = require('./middlewares/viewLocals');
const { notFound, errorConverter, errorHandler } = require('./middlewares/error');
const routes = require('./routes/v1');
const webRoutes = require('./routes/web');
const { setupSwagger } = require('./docs/swagger');
const healthController = require('./controllers/health.controller');
const metricsController = require('./controllers/metrics.controller');
const logger = require('./config/logger');
const pkg = require('../package.json');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.security.trustProxy);
app.set('query parser', 'simple');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.app = {
  name: config.appName,
  // The version is only shown outside production, so attackers learn nothing from the footer.
  version: config.isProduction ? null : pkg.version,
  motion: config.motion,
};
app.locals.sessionCookieName = config.security.session.name;
app.locals.docsEnabled = config.docsEnabled;

app.use(requestId);
app.use(metrics.middleware);
app.use(requestLogger);

app.use(viewDefaults);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'none'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'"],
        'img-src': ["'self'"],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'manifest-src': ["'self'"],
        'media-src': ["'none'"],
        'worker-src': ["'none'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        ...(config.isProduction ? { 'upgrade-insecure-requests': [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
  })
);

app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), ' +
      'microphone=(), payment=(), usb=(), browsing-topics=()'
  );
  // Nothing dynamic is cacheable: profiles and tokens must not end up in shared or browser caches.
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(
  '/assets',
  express.static(path.join(__dirname, 'public'), {
    dotfiles: 'ignore',
    index: false,
    redirect: false,
    etag: true,
    maxAge: config.isProduction ? '7d' : 0,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', config.isProduction ? 'public, max-age=604800' : 'no-cache');
    },
  })
);

app.get('/health', healthController.liveness);
app.get('/health/ready', healthController.readiness);
// Prometheus scrape endpoint. Exists only with METRICS_TOKEN and is not rate limited, so scrapes never fail.
app.get('/metrics', metricsController.scrape);

app.use(apiLimiter);
app.use(compression());

// Only listed origins may call the API from a browser. Without CORS_ORIGIN no cross-origin access at all.
const allowAllOrigins = !config.isProduction && config.cors.origins.includes('*');
app.use(
  '/v1',
  cors({
    origin: allowAllOrigins ? '*' : config.cors.origins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '100kb', strict: true, type: 'application/json' }));
app.use(express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 50 }));
app.use(sanitize);

setupSwagger(app);
app.use('/v1', routes);

const sessionStore =
  config.env === 'test'
    ? new session.MemoryStore()
    : MongoStore.create({
        mongoUrl: config.mongoose.url,
        dbName: config.mongoose.options.dbName,
        collectionName: 'sessions',
        ttl: config.security.session.idleTimeoutMinutes * 60,
        autoRemove: 'native',
        // Session data is encrypted with AES-GCM. The key is derived separately from the cookie signing key.
        cryptoAdapter: createWebCryptoAdapter({
          secret: Buffer.from(
            crypto.hkdfSync('sha256', config.security.session.secret, 'expressjs-template', 'session-store', 32)
          ),
          salt: 'expressjs-template:session-store',
        }),
      });

if (sessionStore.on) {
  sessionStore.on('error', (error) => logger.error('Session store error: %s', error.message));
}

// Sessions only exist for the browser UI. API calls authenticate with bearer tokens and never get a cookie.
app.use(
  '/',
  session({
    name: config.security.session.name,
    secret: config.security.session.secret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    proxy: config.security.trustProxy > 0,
    rolling: true,
    unset: 'destroy',
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.security.session.cookieSecure,
      path: '/',
      maxAge: config.security.session.idleTimeoutMinutes * 60 * 1000,
    },
  }),
  saveSessionBeforeRedirect,
  webRoutes
);

app.use(notFound);
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
