// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const roles = ['user', 'admin'];

const roleRights = new Map([
  ['user', ['getProfile']],
  ['admin', ['getProfile', 'manageUsers']],
]);

module.exports = {
  roles,
  roleRights,
};
