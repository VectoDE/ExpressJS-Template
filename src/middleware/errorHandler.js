exports.errorHandler = function(err, req, res, next) {
    console.error(err.stack);

    // Standardfehlerstatuscode
    let statusCode = 500;
    let message = 'Interner Serverfehler';

    // Bestimmte Fehlercodes behandeln
    if (err.code === 'ENOENT') {
        statusCode = 404;
        message = 'Datei nicht gefunden';
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message || 'Ungültige Anforderungsdaten';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unberechtigter Zugriff';
    } else if (err.name === 'SyntaxError') {
        statusCode = 400;
        message = 'Ungültige JSON-Daten';
    }

    // Fehlerbehandlung für JSON-Format
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(statusCode).json({ error: message });
    } else {
        // Fehlerbehandlung für HTML-Format
        res.status(statusCode).send(`<h1>${message}</h1>`);
    }
};