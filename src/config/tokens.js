// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  // Short-lived JWT between password and second factor at sign-in. Never stored.
  TWO_FACTOR: 'twoFactor',
  // Opaque single-use tokens sent by email. Stored as SHA-256 only.
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
  // Single-use WebAuthn challenges for adding a passkey and for signing in with one. Stored as SHA-256 only.
  PASSKEY_REGISTRATION: 'passkeyRegister',
  PASSKEY_LOGIN: 'passkeyLogin',
};

module.exports = {
  tokenTypes,
};
