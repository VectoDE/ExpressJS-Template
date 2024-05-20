const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const checkRole = require('../middleware/checkRole');

router.post('/', checkRole(['admin']), usersController.createUser);
router.put('/:id', checkRole(['admin']), usersController.updateUser);
router.delete('/:id', checkRole(['admin']), usersController.deleteUser);

router.get('/', checkRole(['admin', 'user']), usersController.getUsers);
router.get('/:id', checkRole(['admin', 'user']), usersController.getUserById);

module.exports = router;
