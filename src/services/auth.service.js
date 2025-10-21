const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const userService = require('./user.service');
const tokenService = require('./token.service');
const { tokenTypes } = require('../config/tokens');

const registerUser = async (userBody) => {
  return userService.createUser(userBody);
};

const loginWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

const logout = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Refresh token is required');
  }
  await tokenService.removeToken(refreshToken, tokenTypes.REFRESH);
};

const refreshAuth = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Refresh token is required');
  }
  const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH);
  const user = await userService.getUserById(refreshTokenDoc.user);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
  await refreshTokenDoc.deleteOne();
  const tokens = await tokenService.generateAuthTokens(user);
  return { user, tokens };
};

module.exports = {
  registerUser,
  loginWithEmailAndPassword,
  logout,
  refreshAuth,
};
