const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const accessLogFile = path.join(logDirectory, 'access.log');
const errorLogFile = path.join(logDirectory, 'error.log');

const logger = (req, res, next) => {
    const accessLog = `${new Date().toISOString()} - ${req.ip} - ${req.method} ${req.url}\n`;
    console.log(accessLog);
    fs.appendFile(accessLogFile, accessLog, (err) => {
        if (err) {
            console.error('Error writing to access log file:', err);
        }
    });

    next();
};

const errorLogger = (err, req, res, next) => {
    const errorLog = `${new Date().toISOString()} - ${req.ip} - ${err.stack}\n`;
    console.error(errorLog);
    fs.appendFile(errorLogFile, errorLog, (err) => {
        if (err) {
            console.error('Error writing to error log file:', err);
        }
    });

    next(err);
};

module.exports = {
    logger,
    errorLogger
};
