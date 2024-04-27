const express = require('express');
const router = express.Router();

const apiController = require('../controllers/apiController');

router.get('/', apiController.getAPI);

router.get('/users', apiController.getAllUsers);

router.get('/users/:id', apiController.getUserById);

router.get('/products', apiController.getAllProducts);

router.get('/products/:id', apiController.getProductById);

module.exports = router;
