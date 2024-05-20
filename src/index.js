require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const { authenticate } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const { logger, errorLogger } = require('./utilities/logger');

const app = express();

const indexRoutes = require('./routes/index.js');
const authRoutes = require('./routes/auth');
const roleRoutes = require('./routes/role');
const apiRoutes = require('./routes/api.js');
const errorRoutes = require('./routes/error.js');
const usersRoutes = require('./routes/users.js');

app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const publicDirectoryPath = path.join(__dirname, 'public');
app.use('/assets', express.static(publicDirectoryPath));

app.use(logger, errorLogger);
app.use(errorHandler);

app.use('/', indexRoutes);
app.use('/error', errorRoutes);
app.use(authenticate);
app.use('/auth', authRoutes);
app.use('/dashboard/role', roleRoutes);
app.use('/api', apiRoutes);
app.use('/users', usersRoutes);

app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

module.exports = app;
