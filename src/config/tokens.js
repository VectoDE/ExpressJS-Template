const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  // Short-lived JWT between password and second factor at sign-in. Never stored.
  TWO_FACTOR: 'twoFactor',
  // Opaque single-use tokens sent by email. Stored as SHA-256 only.
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
};

module.exports = {
  tokenTypes,
};
