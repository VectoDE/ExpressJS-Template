require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const logger = require('./middleware/logger');
const { authenticate, generateToken } = require('./middleware/auth');

const app = express();

const indexRoutes = require('./routes/index.js');
const apiRoutes = require('./routes/api.js');
const errorRoutes = require('./routes/error.js');
const usersRoutes = require('./routes/users.js');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use('/static', express.static(path.join(__dirname, 'public')));

app.use(logger);
app.use(generateToken);
app.use(authenticate);

app.use('/', indexRoutes);
app.use('/api', apiRoutes);
app.use('/users', usersRoutes);
app.use('/error', errorRoutes);

module.exports = app;
