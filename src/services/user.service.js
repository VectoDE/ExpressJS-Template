const mongoose = require('mongoose');
const User = require('../models/user.model');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const tokenService = require('./token.service');
const auditService = require('./audit.service');

const SORTABLE_FIELDS = new Set(['name', 'email', 'role', 'createdAt', 'updatedAt']);

const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const toUserResponse = (userDoc) => (userDoc ? userDoc.toPublic() : null);

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  return User.create({
    name: userBody.name,
    email: userBody.email,
    password: userBody.password,
    role: userBody.role || 'user',
    locale: User.LOCALES.includes(userBody.locale) ? userBody.locale : undefined,
  });
};

const queryUsers = async (filter = {}, options = {}) => {
  const [sortField, sortOrder] = (options.sortBy || 'createdAt:desc').split(':');
  if (!SORTABLE_FIELDS.has(sortField)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'sortBy is not allowed');
  }
  const query = {};
  if (filter.role) {
    query.role = String(filter.role);
  }
  // Search is a case-insensitive substring match on name and email. Input is escaped, never a pattern.
  if (filter.search) {
    const pattern = mongoose.trusted({
      $regex: escapeRegExp(String(filter.search).trim().slice(0, 100)),
      $options: 'i',
    });
    query.$or = [{ name: pattern }, { email: pattern }];
  }
  const limit = Math.min(Math.max(Number.parseInt(options.limit, 10) || 10, 1), 100);
  const page = Math.max(Number.parseInt(options.page, 10) || 1, 1);

  const [results, totalResults] = await Promise.all([
    User.find(query)
      .select('+twoFactor')
      .sort({ [sortField]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    results: results.map((user) => toUserResponse(user)),
    page,
    limit,
    totalPages: Math.max(Math.ceil(totalResults / limit), 1),
    totalResults,
  };
};

// The two-factor block is loaded so toPublic can report whether it is on; toPublic never exposes the secret.
const getUserById = async (id) => User.findById(id).select('+twoFactor');

const getUserByEmail = async (email, { withSecrets = false } = {}) => {
  const query = User.findOne({ email: String(email).toLowerCase() });
  return withSecrets ? query.select('+password +failedLoginAttempts +lockUntil +twoFactor') : query;
};

const updateUserById = async (userId, updateBody, context = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  ['name', 'email', 'password', 'role'].forEach((field) => {
    if (updateBody[field] !== undefined) {
      user[field] = updateBody[field];
    }
  });
  const roleChanged = user.isModified('role');
  const credentialsChanged = user.isModified('password') || roleChanged || user.isModified('email');
  if (user.isModified('email')) {
    user.isEmailVerified = false;
  }
  await user.save();
  if (credentialsChanged) {
    await tokenService.revokeAllForUser(user.id);
  }
  if (roleChanged) {
    await auditService.record(user._id, 'roleChanged', context);
  }
  return user;
};

// Erasure: the account, every token of every type and the activity log.
const removeUserData = async (user) => {
  await user.deleteOne();
  await Token.deleteMany({ user: user._id });
  await auditService.removeForUser(user._id);
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
  toUserResponse,
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  removeUserData,
};
