// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const config = require('../config/config');
const db = require('../db');
const { LOCALES } = require('../db/records');
const { newId } = require('../utils/id');
const { hashPassword } = require('../utils/password');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const tokenService = require('./token.service');
const auditService = require('./audit.service');

const SORTABLE_FIELDS = new Set(['name', 'email', 'role', 'createdAt', 'updatedAt']);
const PUBLIC_FIELDS = ['id', 'name', 'email', 'role', 'isEmailVerified', 'locale', 'createdAt', 'updatedAt'];

const normalizeEmail = (email) => String(email).trim().toLowerCase();

// The public view of an account. Only a flag tells whether two-factor sign-in is on; secrets never leave.
const toUserResponse = (user) => {
  if (!user) {
    return null;
  }
  const response = {};
  PUBLIC_FIELDS.forEach((field) => {
    if (user[field] !== undefined && user[field] !== null) {
      response[field] = user[field];
    }
  });
  response.twoFactorEnabled = Boolean(user.twoFactor?.enabled);
  return response;
};

const isEmailTaken = (email, excludeUserId) => db.users.emailTaken(normalizeEmail(email), excludeUserId);

const createUser = async (userBody) => {
  if (await isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  return db.users.create({
    id: newId(),
    name: String(userBody.name).trim(),
    email: normalizeEmail(userBody.email),
    password: await hashPassword(userBody.password),
    role: userBody.role || 'user',
    isEmailVerified: Boolean(userBody.isEmailVerified),
    locale: LOCALES.includes(userBody.locale) ? userBody.locale : config.defaultLocale,
  });
};

const queryUsers = async (filter = {}, options = {}) => {
  const [sortField, sortOrder] = (options.sortBy || 'createdAt:desc').split(':');
  if (!SORTABLE_FIELDS.has(sortField)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'sortBy is not allowed');
  }
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 10, 1), 100);
  const page = Math.max(Number.parseInt(options.page, 10) || 1, 1);
  // Search is a case-insensitive substring match on name and email. Input is matched literally, never a pattern.
  const search = filter.search ? String(filter.search).trim().slice(0, 100) : '';

  const { results, total } = await db.users.list(
    { role: filter.role ? String(filter.role) : undefined, search: search || undefined },
    { sortBy: sortField, descending: sortOrder === 'desc', offset: (page - 1) * limit, limit }
  );

  return {
    results: results.map((user) => toUserResponse(user)),
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    totalResults: total,
  };
};

const getUserById = (id) => db.users.findById(id);

const getUserByEmail = (email) => db.users.findByEmail(normalizeEmail(email));

/**
 * Applies changes to an account and returns the updated record. A new password is hashed here; a changed password,
 * email or role moves credentialsChangedAt, which ends every token and session issued before.
 */
const saveChanges = async (user, changes) => {
  const update = {};
  if (changes.name !== undefined) update.name = String(changes.name).trim();
  if (changes.email !== undefined && normalizeEmail(changes.email) !== user.email) {
    update.email = normalizeEmail(changes.email);
    update.isEmailVerified = false;
  }
  if (changes.password !== undefined) update.password = await hashPassword(changes.password);
  if (changes.role !== undefined && changes.role !== user.role) update.role = changes.role;
  if (changes.locale !== undefined && LOCALES.includes(changes.locale)) update.locale = changes.locale;
  if (changes.isEmailVerified !== undefined) update.isEmailVerified = Boolean(changes.isEmailVerified);
  if (update.password || update.email || update.role) {
    update.credentialsChangedAt = new Date();
  }
  if (Object.keys(update).length) {
    await db.users.update(user.id, update);
  }
  return {
    user: await db.users.findById(user.id),
    emailChanged: Boolean(update.email),
    passwordChanged: Boolean(update.password),
    roleChanged: Boolean(update.role),
  };
};

const updateUserById = async (userId, updateBody, context = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  const changes = {};
  ['name', 'email', 'password', 'role'].forEach((field) => {
    if (updateBody[field] !== undefined) {
      changes[field] = updateBody[field];
    }
  });
  const result = await saveChanges(user, changes);
  if (result.emailChanged || result.passwordChanged || result.roleChanged) {
    await tokenService.revokeAllForUser(user.id);
  }
  if (result.roleChanged) {
    await auditService.record(user.id, 'roleChanged', context);
  }
  return result.user;
};

// Erasure: the account, its passkeys, every token of every type and the activity log.
const removeUserData = async (user) => {
  await db.users.remove(user.id);
  await db.passkeys.removeForUser(user.id);
  await db.tokens.remove({ userId: user.id });
  await auditService.removeForUser(user.id);
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await removeUserData(user);
  return user;
};

module.exports = {
  LOCALES,
  toUserResponse,
  isEmailTaken,
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  saveChanges,
  updateUserById,
  deleteUserById,
  removeUserData,
};
