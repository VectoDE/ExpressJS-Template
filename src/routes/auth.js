const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const updateUserStatusMiddleware = require('../middleware/updateUserStatus');

router.post('/register', authController.register);

router.post('/login', authController.login, updateUserStatusMiddleware);

router.get('/verify', authController.verifyEmail);

module.exports = router;
