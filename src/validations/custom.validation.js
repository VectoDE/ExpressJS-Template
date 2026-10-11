const Joi = require('joi');
const { MAX_PASSWORD_LENGTH } = require('../utils/password');

const objectId = (value, helpers) => {
  if (!/^[0-9a-fA-F]{24}$/.test(value)) {
    return helpers.message('"{#label}" must be a valid id');
  }
  return value;
};

// At least 12 characters with lower case, upper case, a digit and a symbol. Any Unicode symbol counts.
const password = (value, helpers) => {
  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u];
  if (value.length < 12 || !classes.every((pattern) => pattern.test(value))) {
    return helpers.message(
      '"{#label}" must be at least 12 characters and contain upper and lower case letters, a digit and a symbol'
    );
  }
  return value;
};

const fields = {
  name: () => Joi.string().trim().min(3).max(120),
  email: () => Joi.string().trim().lowercase().max(254).email(),
  newPassword: () => Joi.string().max(MAX_PASSWORD_LENGTH).custom(password),
  // Login accepts any stored password, it only caps the length so hashing cannot be abused.
  anyPassword: () => Joi.string().max(MAX_PASSWORD_LENGTH),
  token: () => Joi.string().max(2048),
  // Opaque token from an email link (base64url, 32 bytes).
  emailToken: () => Joi.string().pattern(/^[A-Za-z0-9_-]{20,128}$/),
  // Six-digit one-time code or a recovery code like 3f9a1-c07e2.
  twoFactorCode: () =>
    Joi.string()
      .trim()
      .max(32)
      .pattern(/^(\d{6}|[0-9a-fA-F]{5}-?[0-9a-fA-F]{5})$/),
  oneTimeCode: () =>
    Joi.string()
      .trim()
      .pattern(/^\d{6}$/),
  locale: () => Joi.string().valid('de', 'en'),
};

module.exports = {
  objectId,
  password,
  fields,
};
