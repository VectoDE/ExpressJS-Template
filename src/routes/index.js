const express = require('express');
const router = express.Router();

const indexController = require('../controllers/indexController');

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
});

router.get('/', indexController.getIndex);
router.get('/about', indexController.getAbout);
router.get('/contact', indexController.getContact);
router.get('/login', indexController.getLogin);
router.get('/register', indexController.getRegister);

module.exports = router;
