const fs = require('fs');
const path = require('path');

const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const logFile = path.join(logDirectory, 'access.log');

const logger = (req, res, next) => {
    const log = `${new Date().toISOString()} - ${req.method} ${req.url}\n`;

    console.log(log);

    fs.appendFile(logFile, log, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });

    next();
};

module.exports = logger;
