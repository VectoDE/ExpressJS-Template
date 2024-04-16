const fs = require('fs');
const path = require('path');

// Verzeichnis für Protokolldateien
const logDirectory = path.join(__dirname, '../logs');

// Überprüfen, ob das Verzeichnis existiert, wenn nicht, erstellen
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

// Middleware zur Protokollierung von HTTP-Anforderungen und -Antworten in einer Datei
exports.logger = function(req, res, next) {
    const logStream = fs.createWriteStream(path.join(logDirectory, 'access.log'), { flags: 'a' });
    logStream.write(`[${new Date().toISOString()}] ${req.method} ${req.url}\n`);
    logStream.end();
    next();
};