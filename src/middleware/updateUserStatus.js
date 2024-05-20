const userStatus = require('../services/userStatus');

const updateUserStatusMiddleware = async (req, res, next) => {
    try {
        const userId = req.user._id; // Verwende _id für MongoDB
        await userStatus.setUserOnline(userId);
        next();
    } catch (error) {
        res.status(500).json({ error: 'Error updating user status' });
    }
};

module.exports = updateUserStatusMiddleware;
