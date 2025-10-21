const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const xss = require('xss-clean');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const config = require('./config/config');
const requestLogger = require('./middlewares/requestLogger');
const { notFound, errorConverter, errorHandler } = require('./middlewares/error');
const routes = require('./routes/v1');
const webRoutes = require('./routes/web');
const { setupSwagger } = require('./docs/swagger');
const healthController = require('./controllers/health.controller');
const logger = require('./config/logger');
const pkg = require('../package.json');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.security.trustProxy ? 1 : 0);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.locals.app = {
  name: 'Express Enterprise Starter',
  version: pkg.version,
};

app.use(
  helmet({
    contentSecurityPolicy: config.security.csp,
    crossOriginEmbedderPolicy: false,
  })
);

const allowAllOrigins = config.cors.origins.includes('*');

app.use(
  cors({
    origin: allowAllOrigins ? '*' : config.cors.origins,
    credentials: !allowAllOrigins,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(xss());
app.use(hpp());
app.use(mongoSanitize());
app.use(cookieParser(config.security.session.secret));

let sessionStore;

if (config.env === 'test') {
  sessionStore = new session.MemoryStore();
} else {
  sessionStore = MongoStore.create({
    mongoUrl: config.mongoose.url,
    dbName: config.mongoose.options.dbName,
    collectionName: 'sessions',
    ttl: config.security.session.idleTimeoutMinutes * 60,
    autoRemove: 'interval',
    autoRemoveInterval: 10,
    crypto: {
      secret: config.security.session.secret,
    },
  });

  sessionStore.on('error', (error) => {
    logger.error('Session store error: %s', error);
  });
}

app.use(
  session({
    name: config.security.session.name,
    secret: config.security.session.secret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    proxy: config.security.trustProxy,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.security.session.cookieSecure,
      maxAge: config.security.session.idleTimeoutMinutes * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  res.locals.app = req.app.locals.app;
  res.locals.currentUser = req.session ? req.session.user || null : null;
  res.locals.isAuthenticated = Boolean(res.locals.currentUser);
  if (typeof res.locals.csrfToken === 'undefined') {
    res.locals.csrfToken = '';
  }
  next();
});

app.use(compression());

app.use(
  '/assets',
  express.static(path.join(__dirname, 'public'), {
    maxAge: config.env === 'production' ? '7d' : 0,
    etag: config.env === 'production',
    setHeaders: (res) => {
      if (config.env === 'production') {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  })
);

app.use(requestLogger);

app.get('/health', healthController.healthCheck);

setupSwagger(app);

app.use('/v1', routes);
app.use('/', webRoutes);

app.use(notFound);
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
