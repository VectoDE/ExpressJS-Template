require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const logger = require('./middleware/logger');
const { authenticate } = require('./middleware/auth');

const app = express();

const indexRoutes = require('./routes/index.js');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api.js');
const errorRoutes = require('./routes/error.js');
const usersRoutes = require('./routes/users.js');

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const publicDirectoryPath = path.join(__dirname, 'public');
app.use('/assets', express.static(publicDirectoryPath));

app.use(logger);

app.use('/', indexRoutes);
app.use('/auth', authRoutes);

app.use(authenticate);
app.use('/api', apiRoutes);
app.use('/users', usersRoutes);
app.use('/error', errorRoutes);

app.use((req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({
        error: {
            message: err.message,
        },
    });
});

module.exports = app;
