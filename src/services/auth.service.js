const config = require('../config/config');
const logger = require('../config/logger');
const { tokenTypes } = require('../config/tokens');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const { burnPasswordCheck, hashPassword, needsRehash } = require('../utils/password');
const userService = require('./user.service');
const tokenService = require('./token.service');
const twoFactorService = require('./twoFactor.service');
const auditService = require('./audit.service');
const emailService = require('./email.service');

const INVALID_CREDENTIALS = 'Incorrect email or password';
const INVALID_CODE = 'Invalid two-factor code';
const INVALID_LINK = 'Invalid or expired link';

const isLocked = (user) => user.lockUntil?.getTime() > Date.now();

/**
 * Sends a fresh verification link to the current address. Returns false when there is nothing to verify.
 * The token remembers the address, so a link sent before an email change cannot verify the new one.
 */
const sendVerificationEmail = async (user) => {
  if (user.isEmailVerified) {
    return false;
  }
  const expires = new Date(Date.now() + config.auth.verifyEmailExpirationHours * 60 * 60 * 1000);
  const token = await tokenService.createEmailToken(user, tokenTypes.VERIFY_EMAIL, expires, { email: user.email });
  emailService.notify(user, 'verifyEmail', { token });
  return true;
};

// The language comes from the request body, else from the browser (Accept-Language or the chosen UI language).
const registerUser = async ({ name, email, password, locale }, context = {}) => {
  const user = await userService.createUser({ name, email, password, role: 'user', locale: locale || context.locale });
  await sendVerificationEmail(user);
  return user;
};

const verifyEmail = async (token, context = {}) => {
  const tokenDoc = await tokenService.consumeEmailToken(token, tokenTypes.VERIFY_EMAIL);
  const user = tokenDoc && (await userService.getUserById(tokenDoc.user));
  if (user?.email !== tokenDoc?.email || !user) {
    throw new ApiError(httpStatus.BAD_REQUEST, INVALID_LINK);
  }
  if (!user.isEmailVerified) {
    await User.updateOne({ _id: user._id }, { $set: { isEmailVerified: true } });
    user.isEmailVerified = true;
    await auditService.record(user._id, 'emailVerified', context);
  }
  return user;
};

// Atomic counter, so parallel guesses cannot slip past the limit. Password and 2FA failures count together.
const recordFailure = async (user, context) => {
  await auditService.record(user._id, 'loginFailed', context);
  const updated = await User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { failedLoginAttempts: 1 } },
    { returnDocument: 'after', projection: { failedLoginAttempts: 1 } }
  );
  if (updated?.failedLoginAttempts >= config.login.maxAttempts) {
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + config.login.lockMs) } }
    );
    logger.warn('Account %s locked after %d failed logins', user.id, updated.failedLoginAttempts);
    await auditService.record(user._id, 'accountLocked', context);
    emailService.notify(user, 'accountLocked');
  }
};

const clearFailures = async (user, extra = {}) => {
  await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, ...extra }, $unset: { lockUntil: 1 } });
};

/**
 * First sign-in step. Same answer and roughly the same time for unknown accounts, wrong passwords and
 * locked accounts, so the endpoint does not reveal which emails exist.
 * Returns the user and whether a second factor is still needed.
 */
const login = async (email, password, context = {}) => {
  const user = await userService.getUserByEmail(email, { withSecrets: true });
  if (!user) {
    await burnPasswordCheck(password);
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
  }

  const locked = isLocked(user);
  const matches = await user.isPasswordMatch(password);
  if (locked || !matches) {
    if (!locked) {
      await recordFailure(user, context);
    }
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
  }

  const rehash = needsRehash(user.password) ? { password: await hashPassword(password) } : {};
  const twoFactorRequired = Boolean(user.twoFactor?.enabled);
  if (twoFactorRequired) {
    // The counter is cleared only after a valid code. Otherwise a correct password between wrong codes
    // would reset it and the lockout would never stop code guessing.
    if (rehash.password) await User.updateOne({ _id: user._id }, { $set: rehash });
  } else {
    await clearFailures(user, rehash);
  }

  // Only reachable with the correct password, so this does not reveal whether the address is registered.
  if (config.auth.requireVerifiedEmail && !user.isEmailVerified) {
    await sendVerificationEmail(user);
    const error = new ApiError(httpStatus.FORBIDDEN, 'Email address not verified. A new verification link was sent.');
    error.reason = 'emailNotVerified';
    throw error;
  }

  if (!twoFactorRequired) {
    await auditService.record(user._id, 'login', context);
  }
  return { user, twoFactorRequired };
};

/**
 * Second sign-in step. A wrong code counts as a failed sign-in, so the lockout also limits code guessing.
 */
const completeTwoFactorLogin = async (userId, code, context = {}) => {
  const user = await User.findById(userId).select('+twoFactor +failedLoginAttempts +lockUntil');
  if (!user?.twoFactor?.enabled || isLocked(user)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_CODE);
  }
  const result = await twoFactorService.verifyCode(user, code);
  if (!result.ok) {
    await recordFailure(user, context);
    throw new ApiError(httpStatus.UNAUTHORIZED, INVALID_CODE);
  }
  await clearFailures(user);
  if (result.recoveryCodeUsed) {
    await auditService.record(user._id, 'recoveryCodeUsed', context);
  }
  await auditService.record(user._id, 'login', context);
  return { user, ...result };
};

// API variant: the challenge token from the first step proves the password; a credential change voids it.
const loginWithTwoFactorChallenge = async (challengeToken, code, context = {}) => {
  const payload = tokenService.decodeToken(challengeToken, tokenTypes.TWO_FACTOR);
  const user = await userService.getUserById(payload.sub);
  if (!user || payload.iat * 1000 < user.credentialsChangedAt.getTime()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token');
  }
  return completeTwoFactorLogin(user.id, code, context);
};

const logout = async (refreshToken) => {
  await tokenService.removeRefreshToken(refreshToken);
};

const refreshAuth = async (refreshToken, context = {}) => {
  let consumed;
  try {
    consumed = await tokenService.consumeRefreshToken(refreshToken);
  } catch (error) {
    if (error.reuseDetectedFor) {
      await auditService.record(error.reuseDetectedFor, 'refreshTokenReuse', context);
    }
    throw error;
  }
  const { userId, issuedAt, session } = consumed;
  const user = await userService.getUserById(userId);
  if (!user || issuedAt * 1000 < user.credentialsChangedAt.getTime()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token');
  }
  const tokens = await tokenService.generateAuthTokens(user, { ...session, device: context.device || session.device });
  return { user, tokens };
};

/**
 * Starts a password reset and returns at once. The lookup and the email run in the background,
 * so neither the answer nor its timing tells whether the address belongs to an account.
 */
const requestPasswordReset = (email, context = {}) => {
  const run = async () => {
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return;
    }
    const expires = new Date(Date.now() + config.auth.resetPasswordExpirationMinutes * 60 * 1000);
    const token = await tokenService.createEmailToken(user, tokenTypes.RESET_PASSWORD, expires);
    await auditService.record(user._id, 'passwordResetRequested', context);
    emailService.notify(user, 'resetPassword', { token });
  };
  run().catch((error) => logger.error('Password reset could not be started: %s', error.message));
};

/**
 * Sets a new password from a reset link. The link proves control of the mailbox, so the address counts as
 * verified afterwards. All sessions and tokens end, and a running lockout is lifted.
 */
const resetPassword = async (token, password, context = {}) => {
  const tokenDoc = await tokenService.consumeEmailToken(token, tokenTypes.RESET_PASSWORD);
  const user = tokenDoc && (await User.findById(tokenDoc.user).select('+password'));
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, INVALID_LINK);
  }
  user.password = password;
  user.isEmailVerified = true;
  await user.save();
  await clearFailures(user);
  await tokenService.revokeAllForUser(user.id);
  await tokenService.removeEmailTokens(user.id, tokenTypes.RESET_PASSWORD);
  await auditService.record(user._id, 'passwordReset', context);
  emailService.notify(user, 'passwordChanged');
  return user;
};

module.exports = {
  registerUser,
  sendVerificationEmail,
  verifyEmail,
  login,
  completeTwoFactorLogin,
  loginWithTwoFactorChallenge,
  logout,
  refreshAuth,
  requestPasswordReset,
  resetPassword,
};
