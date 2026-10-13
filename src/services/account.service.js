// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const db = require('../db');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');
const { comparePassword } = require('../utils/password');
const { tokenTypes } = require('../config/tokens');
const tokenService = require('./token.service');
const userService = require('./user.service');
const auditService = require('./audit.service');
const emailService = require('./email.service');
const twoFactorService = require('./twoFactor.service');
const passkeyService = require('./passkey.service');
const authService = require('./auth.service');

/**
 * Self-service for the signed-in user, including the data subject rights of the GDPR:
 * access and portability (Art. 15, 20), rectification (Art. 16) and erasure (Art. 17).
 */

const loadWithPassword = async (userId) => {
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

const exportData = async (userId) => {
  const user = await db.users.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const [sessions, activity, passkeys] = await Promise.all([
    tokenService.listSessions(userId),
    auditService.listForUser(userId, 1000),
    passkeyService.list(userId),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: 'expressjs-template/account-export@2',
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locale: user.locale,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      credentialsChangedAt: user.credentialsChangedAt,
    },
    twoFactor: twoFactorService.status(user),
    passkeys,
    activeApiSessions: sessions,
    activity,
    notes: [
      'The password is stored only as a scrypt hash and is not part of this export.',
      'The two-factor secret is stored encrypted and recovery codes only as hashes; neither is exported.',
      'Passkeys are listed by name; their public keys only work for this site and are not exported.',
      'Browser sessions are stored encrypted and expire after inactivity.',
    ],
  };
};

/**
 * Rectification. Email and password changes need the current password and end every other session.
 * A new email address has to be verified again; the old address is told about the change.
 */
const updateProfile = async (userId, { currentPassword, ...changes }, context = {}) => {
  const user = await loadWithPassword(userId);
  if (changes.email || changes.password) {
    await confirmPassword(user, currentPassword);
  }
  if (changes.email && (await userService.isEmailTaken(changes.email, userId))) {
    throw new ApiError(httpStatus.CONFLICT, 'Email already taken');
  }
  const previousEmail = user.email;
  const update = {};
  ['name', 'email', 'password', 'locale'].forEach((field) => {
    if (changes[field] !== undefined) {
      update[field] = changes[field];
    }
  });
  const saved = await userService.saveChanges(user, update);
  const { emailChanged, passwordChanged } = saved;
  const updated = saved.user;

  if (emailChanged || passwordChanged) {
    await tokenService.revokeAllForUser(updated.id);
  }
  if (emailChanged) {
    await tokenService.removeEmailTokens(updated.id, tokenTypes.RESET_PASSWORD);
    await auditService.record(updated.id, 'emailChanged', context);
    emailService.notify(updated, 'emailChanged', { to: previousEmail, newEmail: updated.email });
    await authService.sendVerificationEmail(updated);
  }
  if (passwordChanged) {
    await auditService.record(updated.id, 'passwordChanged', context);
    emailService.notify(updated, 'passwordChanged');
  }
  return updated;
};

const setLocale = async (userId, locale) => {
  if (!userService.LOCALES.includes(locale)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Unsupported locale');
  }
  await db.users.update(userId, { locale });
};

const listSessions = (userId) => tokenService.listSessions(userId);

const revokeSession = async (userId, sessionId, context = {}) => {
  if (!(await tokenService.revokeSession(userId, sessionId))) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');
  }
  await auditService.record(userId, 'sessionRevoked', context);
};

/**
 * Ends every API session and every browser session of the account. Moving credentialsChangedAt forward
 * invalidates access tokens and sessions that were issued before; the caller starts a fresh one if needed.
 */
const revokeAllSessions = async (userId, context = {}) => {
  await tokenService.revokeAllForUser(userId);
  await db.users.update(userId, { credentialsChangedAt: new Date() });
  await auditService.record(userId, 'allSessionsRevoked', context);
  return db.users.findById(userId);
};

const listActivity = (userId, limit = 20) => auditService.listForUser(userId, limit);

const deleteAccount = async (userId, password) => {
  const user = await loadWithPassword(userId);
  await confirmPassword(user, password);
  await userService.removeUserData(user);
};

module.exports = {
  exportData,
  updateProfile,
  setLocale,
  listSessions,
  revokeSession,
  revokeAllSessions,
  listActivity,
  deleteAccount,
};
