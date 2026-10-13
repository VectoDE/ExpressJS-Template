// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const config = require('../config/config');
const httpStatus = require('../utils/httpStatus');
const ApiError = require('../utils/ApiError');
const requestContext = require('../utils/requestContext');
const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const userService = require('../services/user.service');

const issueTokens = async (req, res, user, status = httpStatus.OK) => {
  const tokens = await tokenService.generateAuthTokens(user, { device: requestContext(req).device });
  res.status(status).json({ user: userService.toUserResponse(user), tokens });
};

// With AUTH_REQUIRE_VERIFIED_EMAIL the account exists, but tokens are only issued after verification.
const register = async (req, res) => {
  const user = await authService.registerUser(req.body, requestContext(req));
  if (config.auth.requireVerifiedEmail) {
    return res.status(httpStatus.CREATED).json({ user: userService.toUserResponse(user), verificationRequired: true });
  }
  return issueTokens(req, res, user, httpStatus.CREATED);
};

/**
 * With two-factor sign-in on, the password alone yields no tokens, only a short-lived challenge
 * that /auth/login/2fa exchanges together with a code.
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  const { user, twoFactorRequired } = await authService.login(email, password, requestContext(req));
  if (twoFactorRequired) {
    return res.status(httpStatus.OK).json({
      twoFactorRequired: true,
      challengeToken: tokenService.generateTwoFactorChallenge(user),
      expiresIn: config.auth.twoFactorChallengeMinutes * 60,
    });
  }
  return issueTokens(req, res, user);
};

const loginTwoFactor = async (req, res) => {
  const { user, recoveryCodeUsed, remainingRecoveryCodes } = await authService.loginWithTwoFactorChallenge(
    req.body.challengeToken,
    req.body.code,
    requestContext(req)
  );
  if (recoveryCodeUsed) {
    res.set('X-Recovery-Codes-Remaining', String(remainingRecoveryCodes));
  }
  return issueTokens(req, res, user);
};

const passkeyOptions = async (req, res) => {
  res.json(await authService.passkeyOptionsForChallenge(req.body.challengeToken));
};

const loginPasskey = async (req, res) => {
  const { user } = await authService.loginWithPasskeyChallenge(
    req.body.challengeToken,
    req.body.response,
    requestContext(req)
  );
  return issueTokens(req, res, user);
};

const logout = async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
};

const refreshTokens = async (req, res) => {
  const { user, tokens } = await authService.refreshAuth(req.body.refreshToken, requestContext(req));
  res.status(httpStatus.OK).json({
    user: userService.toUserResponse(user),
    tokens,
  });
};

const sendVerificationEmail = async (req, res) => {
  if (!(await authService.sendVerificationEmail(req.user))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email address is already verified');
  }
  res.status(httpStatus.NO_CONTENT).send();
};

const verifyEmail = async (req, res) => {
  await authService.verifyEmail(req.body.token, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

// Always 204, whether or not the address has an account.
const forgotPassword = async (req, res) => {
  await authService.requestPasswordReset(req.body.email, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

const resetPassword = async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

module.exports = {
  register,
  login,
  loginTwoFactor,
  passkeyOptions,
  loginPasskey,
  logout,
  refreshTokens,
  sendVerificationEmail,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
