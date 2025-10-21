const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const userService = require('../services/user.service');

const register = catchAsync(async (req, res) => {
  const user = await authService.registerUser(req.body);
  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.CREATED).json({
    user: userService.toUserResponse(user),
    tokens,
  });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.loginWithEmailAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.status(httpStatus.OK).json({
    user: userService.toUserResponse(user),
    tokens,
  });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const { user, tokens } = await authService.refreshAuth(req.body.refreshToken);
  res.status(httpStatus.OK).json({
    user: userService.toUserResponse(user),
    tokens,
  });
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
};
