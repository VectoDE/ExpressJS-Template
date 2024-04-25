require('dotenv').config();
const express = require('express');

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const session = require('express-session');
const bodyParser = require('body-parser');

const ejs = require('ejs');

const PORT = process.env.PORT || 8080;

const app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Statische Dateien
app.use('/static', express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('views', path.join(__dirname, '/views'));
app.engine('html', ejs.renderFile);
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

//app.get('/about', (req, res) => {
//    res.render('about', { title: 'About' });
//});

//app.get('/contact', (req, res) => {
//    res.render('contact', { title: 'Contact' });
//});

//app.get('/login', (req, res) => {
//    res.render('login', { title: 'Login' });
//});

//app.get('/register', (req, res) => {
//    res.render('register', { title: 'Register' });
//});

//app.get('/logout', (req, res) => {
//    req.session.destroy();
//    res.redirect('/');
//});


app.listen(PORT, () => {
    console.log(`Example App is listening on port ${PORT}`);
});