const jwt = require('jsonwebtoken');
const fs = require('fs');

const secretKey = process.env.JWT_SECRET || 'yourSecretKey'; // Secret Key aus Umgebungsvariable oder Standardwert

// Funktion zum Generieren eines JWT-Tokens
const generateToken = (payload) => {
    return jwt.sign(payload, secretKey, { expiresIn: '1h' }); // Token läuft nach 1 Stunde ab
};

// Funktion zum Überprüfen und Aktualisieren eines JWT-Tokens
const verifyAndUpdateToken = (token) => {
    try {
        const decoded = jwt.verify(token, secretKey);
        return {
            valid: true,
            user: decoded.user,
            token: token,
        };
    } catch (error) {
        // Token ist ungültig oder abgelaufen
        return { valid: false };
    }
};

// Funktion zum Löschen eines JWT-Tokens aus der .env-Datei
const deleteTokenFromEnv = () => {
    try {
        fs.writeFileSync('.env', fs.readFileSync('.env', 'utf8').replace(/JWT_TOKEN=.*\n/, ''));
    } catch (error) {
        console.error('Error deleting token from .env file:', error);
    }
};

// Middleware für die Authentifizierung mit JWT
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const tokenData = verifyAndUpdateToken(token);

    if (!tokenData.valid) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = tokenData.user;

    // Überprüfen, ob Token abgelaufen ist und falls ja, löschen
    if (jwt.decode(token).exp * 1000 < Date.now()) {
        deleteTokenFromEnv();
    }

    next();
};

module.exports = {
    authenticate,
    generateToken,
};
