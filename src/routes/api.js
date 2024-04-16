const express = require('express');
const router = express.Router();
const passport = require('../middleware/auth');

const users = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Doe' }
];

router.get('/', (req, res) => {
    // Führen Sie hier die gewünschten Leistungsüberprüfungen durch
    res.json({ message: 'Overview API' });
});

router.get('/v1', (req, res) => {
    // Führen Sie hier die gewünschten Leistungsüberprüfungen durch
    res.json({ message: 'Documentation API v1' });
});

router.get('/creator', (req, res) => {
    // Führen Sie hier die gewünschten Leistungsüberprüfungen durch
    res.json({ message: 'Creator API' });
});

// API-Endpunkt für Server-Performance
router.get('/performance', (req, res) => {
    // Führen Sie hier die gewünschten Leistungsüberprüfungen durch
    res.json({ message: 'Server-Performance API' });
});

router.get('/users', ensureAuthenticated, (req, res) => {
    res.json(users);
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
}

module.exports = router;