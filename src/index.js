require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const { validationResult, check } = require('express-validator');
const morgan = require('morgan');
const passport = require('./middleware/auth');
const { logger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');
const connectToDatabase = require('./database/connect');
const { formatDate, calculateDaysDifference } = require('./utils/dateUtils');
const { truncate, reverse } = require('./utils/stringUtils');

const app = express();

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Statische Dateien
app.use(express.static(__dirname + '/public'));

// Ansichten konfigurieren
const viewsFolder = path.join(__dirname, '/views');
app.set('views', viewsFolder);
app.engine('html', ejs.renderFile);
app.set('view engine', 'ejs');

// HTTP- und HTTPS-Server erstellen
const options = {
    dotfiles: 'ignore',
    etag: false,
    extensions: ['html', 'ejs'],
    index: false,
    maxAge: '1d',
    redirect: false,
    setHeaders(res, path, stat) {
        res.set('x-timestamp', Date.now());
    }
};

http.createServer(app).listen(80);
https.createServer(options, app).listen(443);

// Verbindung zur Datenbank herstellen
const dbConnection = connectToDatabase();

if (!dbConnection) {
    console.error('Fehler beim Herstellen der Verbindung zur Datenbank. Die Anwendung wird beendet.');
    process.exit(1);
}

// Middleware
app.use(bodyParser.json());
app.use(logger);
app.use(errorHandler);
app.use(passport.initialize());
app.use(passport.session());

const getUsers = require('./models/mysqlUser');

// Controller und Routen für Benutzer und Produkte
const apiRouter = require('./routes/api');

const users = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Doe' }
];

// Routen
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

app.get('/about', (req, res) => {
    getUsers((err, users) => {
      if (err) {
        console.error('Fehler beim Abrufen der Benutzerdaten:', err);
        res.status(500).send('Interner Serverfehler');
        return;
      }
      res.render('about', { title: 'About', users });
    });
  });

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact' });
});

// Port definieren und Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}!`);
});
