// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const httpStatus = require('../utils/httpStatus');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const userService = require('../services/user.service');
const requestContext = require('../utils/requestContext');

const createUser = async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).json({ user: userService.toUserResponse(user) });
};

const getUsers = async (req, res) => {
  const filter = pick(req.query, ['role', 'search']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.status(httpStatus.OK).json(result);
};

const getUser = async (req, res) => {
  const user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.status(httpStatus.OK).json({ user: userService.toUserResponse(user) });
};

// An admin cannot demote or delete their own account, so the last admin cannot lock everyone out.
const updateUser = async (req, res) => {
  if (req.params.userId === req.user.id && req.body.role && req.body.role !== req.user.role) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot change your own role');
  }
  const user = await userService.updateUserById(req.params.userId, req.body, requestContext(req));
  res.status(httpStatus.OK).json({ user: userService.toUserResponse(user) });
};

const deleteUser = async (req, res) => {
  if (req.params.userId === req.user.id) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot delete your own account here');
  }
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
};

const getProfile = async (req, res) => {
  res.status(httpStatus.OK).json({ user: userService.toUserResponse(req.user) });
};

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getProfile,
};
