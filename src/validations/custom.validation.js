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

const base64url = (max) =>
  Joi.string()
    .max(max)
    .pattern(/^[A-Za-z0-9_-]*$/);

// The JSON form of a PublicKeyCredential (registration or assertion). The signatures inside are checked by
// @simplewebauthn/server; this only keeps the shape and the sizes in bounds.
const passkeyResponse = () =>
  Joi.object().keys({
    id: base64url(1400).min(1).required(),
    rawId: base64url(1400).min(1).required(),
    type: Joi.string().valid('public-key').required(),
    authenticatorAttachment: Joi.string().valid('platform', 'cross-platform'),
    clientExtensionResults: Joi.object().max(20).unknown(true).default({}),
    response: Joi.object()
      .keys({
        clientDataJSON: base64url(4096).required(),
        attestationObject: base64url(12000),
        authenticatorData: base64url(12000),
        signature: base64url(2048),
        userHandle: base64url(256).allow(null),
        publicKey: base64url(4096),
        publicKeyAlgorithm: Joi.number().integer(),
        transports: Joi.array().items(Joi.string().max(20)).max(10),
      })
      .required(),
  });

// Browser forms send the credential as JSON text in one field; it has to parse and then match the schema.
const jsonText = (schema) =>
  Joi.string()
    .max(16000)
    .custom((value, helpers) => {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        return helpers.error('any.invalid');
      }
      const { error, value: checked } = schema.validate(parsed);
      return error ? helpers.error('any.invalid') : checked;
    });

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
  locale: () => Joi.string().valid('en', 'de'),
  passkeyName: () => Joi.string().trim().min(1).max(60),
  passkeyResponse,
  passkeyResponseText: () => jsonText(passkeyResponse()),
};

module.exports = {
  objectId,
  password,
  fields,
};
