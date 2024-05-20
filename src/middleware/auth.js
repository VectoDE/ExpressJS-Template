const jwt = require('jsonwebtoken');
const fs = require('fs');

const secretKey = process.env.JWT_SECRET || 'yourSecretKey';

const generateToken = (payload) => {
    if (typeof payload !== 'object' || payload === null) {
        throw new Error('Payload must be a plain object');
    }
    return jwt.sign(payload, secretKey, { expiresIn: '1h' });
};

const verifyAndUpdateToken = (token) => {
    try {
        const decoded = jwt.verify(token, secretKey);
        return {
            valid: true,
            user: decoded.user,
            token: token,
        };
    } catch (error) {
        return { valid: false };
    }
};

const generateVerificationToken = (user) => {
    const payload = {
        id: user._id, // Use _id for MongoDB
        email: user.email,
        type: 'email_verification',
    };
    return jwt.sign(payload, secretKey, { expiresIn: '1h' });
};

const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, secretKey);
        return decoded;
    } catch (error) {
        return null;
    }
};

const deleteTokenFromEnv = () => {
    try {
        fs.writeFileSync('.env', fs.readFileSync('.env', 'utf8').replace(/JWT_TOKEN=.*\n/, ''));
    } catch (error) {
        console.error('Error deleting token from .env file:', error);
    }
};

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
    next();
};

module.exports = {
    generateVerificationToken,
    verifyToken,
    authenticate,
    generateToken,
};
