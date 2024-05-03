const express = require('express');
const router = express.Router();
const errorController = require('../controllers/errorController');

router.get(errorController.index);

router.use(errorController.handleNotFound);

router.use(errorController.handleInternalError);

module.exports = router;
