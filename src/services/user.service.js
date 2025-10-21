const httpStatus = require('http-status');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');

const toUserResponse = (userDoc) => {
  if (!userDoc) {
    return null;
  }
  const user = userDoc.toObject({ getters: true, virtuals: false });
  user.id = userDoc.id;
  delete user.password;
  delete user._id;
  delete user.__v;
  return user;
};

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return User.create(userBody);
};

const queryUsers = async (filter = {}, options = {}) => {
  const sortBy = options.sortBy || 'createdAt:desc';
  const [sortField, sortOrder] = sortBy.split(':');
  const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
  const limit = Math.max(parseInt(options.limit || 10, 10), 1);
  const page = Math.max(parseInt(options.page || 1, 10), 1);
  const skip = (page - 1) * limit;

  const [results, totalResults] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    results: results.map((user) => toUserResponse(user)),
    page,
    limit,
    totalPages: Math.max(Math.ceil(totalResults / limit), 1),
    totalResults,
  };
};

const getUserById = async (id) => User.findById(id);

const getUserByEmail = async (email) => User.findOne({ email });

const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.deleteOne();
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
};
