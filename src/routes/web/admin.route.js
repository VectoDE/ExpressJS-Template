// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const express = require('express');
const { ensureAuthenticated, requireRights } = require('../../middlewares/viewAuth');
const adminController = require('../../controllers/web/admin.controller');

// User administration in the browser. Same right as the /v1/users API.
const router = express.Router();

router.use(ensureAuthenticated, requireRights('manageUsers'));

router.get('/users', adminController.listUsers);
router.route('/users/:userId').get(adminController.renderUser).post(adminController.updateUser);
router.post('/users/:userId/delete', adminController.deleteUser);

module.exports = router;
