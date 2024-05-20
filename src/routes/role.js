const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');

router.post('/create', roleController.createRole);
router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);
router.put('/:id/update', roleController.updateRole);
router.delete('/:id/delete', roleController.deleteRole);

module.exports = router;
