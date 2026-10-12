const crypto = require('node:crypto');
const { renderSVG } = require('uqr');
const config = require('../config/config');
const db = require('../db');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const totp = require('../utils/totp');
const { encrypt, decrypt, sha256 } = require('../utils/crypto');
const { comparePassword } = require('../utils/password');
const auditService = require('./audit.service');
const emailService = require('./email.service');

/**
 * Two-factor sign-in with time-based one-time passwords (RFC 6238) and single-use recovery codes.
 * Setup has two steps: a pending secret is stored encrypted and only becomes active once the user
 * proves with a code that the authenticator app has it.
 */
const RECOVERY_CODE_COUNT = 10;

const newRecoveryCodes = () =>
  Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const hex = crypto.randomBytes(5).toString('hex');
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });

// Dashes, spaces and case do not matter when a recovery code is typed in.
const hashRecoveryCode = (code) =>
  sha256(
    String(code)
      .toLowerCase()
      .replaceAll(/[^0-9a-f]/g, '')
  );

const loadUser = async (userId) => {
  const user = await db.users.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

const confirmPassword = async (user, password) => {
  if (!(await comparePassword(password, user.password))) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Current password is incorrect');
  }
};

const describeSecret = (user, secret) => {
  const otpauthUrl = totp.otpauthUrl({ secret, account: user.email, issuer: config.appName });
  return { secret, otpauthUrl, qrSvg: renderSVG(otpauthUrl, { border: 2 }) };
};

const startSetup = async (userId, password) => {
  const user = await loadUser(userId);
  await confirmPassword(user, password);
  if (user.twoFactor?.enabled) {
    throw new ApiError(httpStatus.CONFLICT, 'Two-factor authentication is already enabled');
  }
  const secret = totp.generateSecret();
  user.twoFactor = { enabled: false, pendingSecret: encrypt(secret), recoveryCodes: [], lastUsedStep: -1 };
  await db.users.update(user.id, { twoFactor: user.twoFactor });
  return describeSecret(user, secret);
};

// The setup waiting for confirmation, or null. Lets the dashboard show the QR code again after a reload.
const pendingSetup = (user) => {
  if (!user.twoFactor || user.twoFactor.enabled || !user.twoFactor.pendingSecret) {
    return null;
  }
  return describeSecret(user, decrypt(user.twoFactor.pendingSecret));
};

const enable = async (userId, code, context = {}) => {
  const user = await loadUser(userId);
  if (user.twoFactor?.enabled) {
    throw new ApiError(httpStatus.CONFLICT, 'Two-factor authentication is already enabled');
  }
  if (!user.twoFactor?.pendingSecret) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Start the two-factor setup first');
  }
  const step = totp.verify(decrypt(user.twoFactor.pendingSecret), code);
  if (step === null) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid two-factor code');
  }
  const recoveryCodes = newRecoveryCodes();
  user.twoFactor = {
    enabled: true,
    secret: user.twoFactor.pendingSecret,
    lastUsedStep: step,
    recoveryCodes: recoveryCodes.map((code) => hashRecoveryCode(code)),
    enabledAt: new Date(),
  };
  await db.users.update(user.id, { twoFactor: user.twoFactor });
  await auditService.record(user.id, 'twoFactorEnabled', context);
  emailService.notify(user, 'twoFactorEnabled');
  return recoveryCodes;
};

/**
 * Checks a one-time code or a recovery code for an account with 2FA enabled.
 * Both updates are conditional, so the same code is never accepted twice, not even by parallel requests.
 */
const verifyCode = async (user, code = '') => {
  const value = String(code).trim();
  if (!user.twoFactor?.enabled || !value) {
    return { ok: false };
  }
  if (/^\d{6}$/.test(value)) {
    const step = totp.verify(decrypt(user.twoFactor.secret), value, { afterStep: user.twoFactor.lastUsedStep });
    if (step === null) {
      return { ok: false };
    }
    return { ok: await db.users.advanceTotpStep(user.id, step), recoveryCodeUsed: false };
  }
  const hash = hashRecoveryCode(value);
  return {
    ok: await db.users.useRecoveryCode(user.id, hash),
    recoveryCodeUsed: true,
    remainingRecoveryCodes: Math.max(user.twoFactor.recoveryCodes.length - 1, 0),
  };
};

const requireCode = async (user, code) => {
  const result = await verifyCode(user, code);
  if (!result.ok) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid two-factor code');
  }
  return result;
};

const disable = async (userId, { password, code }, context = {}) => {
  const user = await loadUser(userId);
  await confirmPassword(user, password);
  if (!user.twoFactor?.enabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Two-factor authentication is not enabled');
  }
  await requireCode(user, code);
  await db.users.update(user.id, { twoFactor: { enabled: false, recoveryCodes: [], lastUsedStep: -1 } });
  // Passkeys are a second factor next to the codes; without two-factor sign-in they would never be asked for.
  await db.passkeys.removeForUser(user.id);
  await auditService.record(user.id, 'twoFactorDisabled', context);
  emailService.notify(user, 'twoFactorDisabled');
};

const regenerateRecoveryCodes = async (userId, code) => {
  const user = await loadUser(userId);
  if (!user.twoFactor?.enabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Two-factor authentication is not enabled');
  }
  await requireCode(user, code);
  const recoveryCodes = newRecoveryCodes();
  await db.users.update(user.id, {
    twoFactor: { ...user.twoFactor, recoveryCodes: recoveryCodes.map((code) => hashRecoveryCode(code)) },
  });
  return recoveryCodes;
};

// Public status for the dashboard and the API. Never contains a secret.
const status = (user) => ({
  enabled: Boolean(user.twoFactor?.enabled),
  enabledAt: user.twoFactor?.enabledAt || null,
  recoveryCodesLeft: user.twoFactor?.enabled ? user.twoFactor.recoveryCodes.length : 0,
  setupPending: Boolean(!user.twoFactor?.enabled && user.twoFactor?.pendingSecret),
});

module.exports = {
  startSetup,
  pendingSetup,
  enable,
  verifyCode,
  disable,
  regenerateRecoveryCodes,
  status,
  loadUser,
  confirmPassword,
  RECOVERY_CODE_COUNT,
};
