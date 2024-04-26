require('dotenv').config();
const express = require('express');
const path = require('path')
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const usersRoutes = require('./routes/users');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')))

app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!")
});

app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
});

app.get('/', indexRoutes.index);
app.post('/api', apiRoutes);
app.post('/users', usersRoutes);

app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`);
});