const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET || 'yourSecretKey';

const checkRole = (roles) => {
    return (req, res, next) => {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, secretKey);
            if (roles.includes(decoded.user.role)) {
                req.user = decoded.user;
                next();
            } else {
                res.status(403).json({ error: 'Access denied' });
            }
        } catch (error) {
            res.status(401).json({ error: 'Invalid token' });
        }
    };
};

module.exports = checkRole;
