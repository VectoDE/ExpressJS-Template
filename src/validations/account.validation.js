const Joi = require('joi');
const { fields, objectId } = require('./custom.validation');

const updateProfile = {
  body: Joi.object()
    .keys({
      name: fields.name(),
      email: fields.email(),
      password: fields.newPassword(),
      currentPassword: fields.anyPassword(),
      locale: fields.locale(),
    })
    .or('name', 'email', 'password', 'locale')
    // Changing email or password needs the current password, so a stolen access token is not enough.
    .with('email', 'currentPassword')
    .with('password', 'currentPassword'),
};

// Browser form: the new password is typed twice so a typo cannot lock the user out.
const changePassword = {
  body: Joi.object().keys({
    currentPassword: fields.anyPassword().required(),
    password: fields.newPassword().required(),
    passwordConfirm: Joi.any().valid(Joi.ref('password')).required(),
  }),
};

const deleteAccount = {
  body: Joi.object().keys({
    password: fields.anyPassword().required(),
  }),
};

const passwordOnly = {
  body: Joi.object().keys({
    password: fields.anyPassword().required(),
  }),
};

const enableTwoFactor = {
  body: Joi.object().keys({
    code: fields.oneTimeCode().required(),
  }),
};

const disableTwoFactor = {
  body: Joi.object().keys({
    password: fields.anyPassword().required(),
    code: fields.twoFactorCode().required(),
  }),
};

const recoveryCodes = {
  body: Joi.object().keys({
    code: fields.twoFactorCode().required(),
  }),
};

const addPasskey = {
  body: Joi.object().keys({
    name: fields.passkeyName().required(),
    response: fields.passkeyResponse().required(),
  }),
};

// Browser form: the same with the credential as JSON text.
const addPasskeyForm = {
  body: Joi.object().keys({
    name: fields.passkeyName().required(),
    response: fields.passkeyResponseText().required(),
  }),
};

const passkeyId = {
  params: Joi.object().keys({
    passkeyId: Joi.string().custom(objectId).required(),
  }),
};

const sessionId = {
  params: Joi.object().keys({
    sessionId: Joi.string()
      .pattern(/^[A-Za-z0-9-]{1,64}$/)
      .required(),
  }),
};

const language = Joi.object().keys({
  locale: fields.locale().required(),
  returnTo: Joi.string().max(2048).allow(''),
});

module.exports = {
  updateProfile,
  changePassword,
  deleteAccount,
  setupTwoFactor: passwordOnly,
  enableTwoFactor,
  disableTwoFactor,
  recoveryCodes,
  passkeyOptions: passwordOnly,
  addPasskey,
  addPasskeyForm,
  passkeyId,
  sessionId,
  language,
};
