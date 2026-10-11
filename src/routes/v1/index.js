const express = require('express');
const authRoute = require('./auth.route');
const accountRoute = require('./account.route');
const userRoute = require('./user.route');

const router = express.Router();

router.use('/auth', authRoute);
router.use('/account', accountRoute);
router.use('/users', userRoute);

module.exports = router;
