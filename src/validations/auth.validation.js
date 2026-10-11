const Joi = require('joi');
const { fields } = require('./custom.validation');

// Public sign-up never accepts a role. Admins are created through /v1/users by an existing admin.
const register = {
  body: Joi.object().keys({
    name: fields.name().required(),
    email: fields.email().required(),
    password: fields.newPassword().required(),
    locale: fields.locale(),
  }),
};

const login = {
  body: Joi.object().keys({
    email: fields.email().required(),
    password: fields.anyPassword().required(),
  }),
};

const logout = {
  body: Joi.object().keys({
    refreshToken: fields.token().required(),
  }),
};

const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: fields.token().required(),
  }),
};

const loginTwoFactor = {
  body: Joi.object().keys({
    challengeToken: fields.token().required(),
    code: fields.twoFactorCode().required(),
  }),
};

const forgotPassword = {
  body: Joi.object().keys({
    email: fields.email().required(),
  }),
};

const resetPassword = {
  body: Joi.object().keys({
    token: fields.emailToken().required(),
    password: fields.newPassword().required(),
  }),
};

// Browser form: the new password is typed twice.
const resetPasswordForm = {
  body: Joi.object().keys({
    token: fields.emailToken().required(),
    password: fields.newPassword().required(),
    passwordConfirm: Joi.any().valid(Joi.ref('password')).required(),
  }),
};

const verifyEmail = {
  body: Joi.object().keys({
    token: fields.emailToken().required(),
  }),
};

const twoFactorForm = {
  body: Joi.object().keys({
    code: fields.twoFactorCode().required(),
  }),
};

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  loginTwoFactor,
  forgotPassword,
  resetPassword,
  resetPasswordForm,
  verifyEmail,
  twoFactorForm,
};
