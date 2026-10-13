// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const config = require('../../config/config');
const { tokenTypes } = require('../../config/tokens');
const httpStatus = require('../../utils/httpStatus');
const authValidation = require('../../validations/auth.validation');
const authService = require('../../services/auth.service');
const passkeyService = require('../../services/passkey.service');
const tokenService = require('../../services/token.service');
const userService = require('../../services/user.service');
const { addFlashMessage, rememberInput } = require('../../utils/flash');
const describeFormErrors = require('../../utils/formErrors');
const requestContext = require('../../utils/requestContext');
const safeRedirect = require('../../utils/safeRedirect');
const { startSession, resetSession, endSession } = require('../../utils/webSession');

const validate = (schema, payload) => schema.validate(payload, { abortEarly: false, stripUnknown: true });

// Only harmless fields are kept for the next render, never passwords.
const typed = (req, field, max) => String(req.body[field] ?? '').slice(0, max);

const flash = (req, type, key, vars) => addFlashMessage(req, { type, text: req.t(key, vars) });

const TWO_FACTOR_WINDOW_MS = config.auth.twoFactorChallengeMinutes * 60 * 1000;

const renderLogin = (req, res) => {
  res.render('pages/auth/login', { title: req.t('auth.login.title') });
};

const renderRegister = (req, res) => {
  res.render('pages/auth/register', { title: req.t('auth.register.title') });
};

/**
 * Password step. The browser session only ever holds the public profile; API tokens are never stored
 * in it or shown in HTML. With 2FA on, the session remembers who passed the password, for a few minutes.
 */
const handleLogin = async (req, res) => {
  const { error, value } = validate(authValidation.login.body, req.body);
  if (error) {
    rememberInput(req, { email: typed(req, 'email', 254) });
    flash(req, 'error', 'flash.loginIncomplete');
    return res.redirect('/login');
  }

  const target = safeRedirect(req.session.returnTo, '/dashboard');
  let result;
  try {
    result = await authService.login(value.email, value.password, requestContext(req));
  } catch (err) {
    if (err.statusCode === httpStatus.UNAUTHORIZED || err.reason === 'emailNotVerified') {
      rememberInput(req, { email: value.email });
      flash(req, 'error', err.reason === 'emailNotVerified' ? 'flash.emailNotVerified' : 'flash.loginInvalid');
      return res.redirect('/login');
    }
    throw err;
  }

  if (result.twoFactorRequired) {
    req.session.pendingLogin = { userId: result.user.id, startedAt: Date.now(), returnTo: target };
    return res.redirect('/login/2fa');
  }
  await startSession(req, result.user, { type: 'success', text: req.t('flash.signedIn', { name: result.user.name }) });
  return res.redirect(target);
};

// The pending sign-in, or null when there is none, it is too old or the password changed in between.
const pendingLogin = async (req) => {
  const pending = req.session.pendingLogin;
  if (!pending || Date.now() - pending.startedAt > TWO_FACTOR_WINDOW_MS) {
    return null;
  }
  const user = await userService.getUserById(pending.userId);
  if (!user || user.credentialsChangedAt.getTime() > pending.startedAt) {
    return null;
  }
  return pending;
};

const expired = (req, res) => {
  delete req.session.pendingLogin;
  flash(req, 'warning', 'flash.twoFactorExpired');
  return res.redirect('/login');
};

const renderTwoFactor = async (req, res) => {
  const pending = await pendingLogin(req);
  if (!pending) {
    return expired(req, res);
  }
  return res.render('pages/auth/two-factor', {
    title: req.t('auth.twoFactor.title'),
    // Only for accounts with a passkey; each page view gets its own single-use challenge.
    passkeyOptions: await passkeyService.authenticationOptions(pending.userId),
    scripts: ['passkeys'],
  });
};

const handleTwoFactor = async (req, res) => {
  const pending = await pendingLogin(req);
  if (!pending) {
    return expired(req, res);
  }
  const { error, value } = validate(authValidation.twoFactorForm.body, req.body);
  if (error) {
    flash(req, 'error', 'fieldErrors.code');
    return res.redirect('/login/2fa');
  }
  let result;
  try {
    result = await authService.completeTwoFactorLogin(pending.userId, value.code, requestContext(req));
  } catch (err) {
    if (err.statusCode === httpStatus.UNAUTHORIZED) {
      flash(req, 'error', 'flash.twoFactorCodeInvalid');
      return res.redirect('/login/2fa');
    }
    throw err;
  }
  await startSession(req, result.user, { type: 'success', text: req.t('flash.signedIn', { name: result.user.name }) });
  if (result.recoveryCodeUsed) {
    flash(req, 'warning', 'flash.recoveryCodeUsed', { count: result.remainingRecoveryCodes });
  }
  return res.redirect(pending.returnTo);
};

// The same second step with a passkey: the browser posts the signed answer as JSON in the field "response".
const handleTwoFactorPasskey = async (req, res) => {
  const pending = await pendingLogin(req);
  if (!pending) {
    return expired(req, res);
  }
  const rejected = () => {
    flash(req, 'error', 'flash.passkeyRejected');
    return res.redirect('/login/2fa');
  };
  const { error, value } = validate(authValidation.passkeyForm.body, req.body);
  if (error) {
    return rejected();
  }
  let result;
  try {
    result = await authService.completePasskeyLogin(pending.userId, value.response, requestContext(req));
  } catch (err) {
    if (err.statusCode === httpStatus.UNAUTHORIZED) {
      return rejected();
    }
    throw err;
  }
  await startSession(req, result.user, { type: 'success', text: req.t('flash.signedIn', { name: result.user.name }) });
  return res.redirect(pending.returnTo);
};

const handleRegister = async (req, res) => {
  const { error, value } = validate(authValidation.register.body, req.body);
  const keepInput = () => rememberInput(req, { name: typed(req, 'name', 120), email: typed(req, 'email', 254) });
  if (error) {
    keepInput();
    addFlashMessage(req, { type: 'error', text: describeFormErrors(error, req.t) });
    return res.redirect('/register');
  }

  let user;
  try {
    user = await authService.registerUser(value, requestContext(req));
  } catch (err) {
    if (err.statusCode === httpStatus.CONFLICT) {
      keepInput();
      flash(req, 'error', 'flash.emailUnavailable');
      return res.redirect('/register');
    }
    throw err;
  }
  // With AUTH_REQUIRE_VERIFIED_EMAIL the account must be confirmed before the first sign-in.
  if (config.auth.requireVerifiedEmail) {
    rememberInput(req, { email: user.email });
    flash(req, 'success', 'flash.registeredVerify');
    return res.redirect('/login');
  }
  await startSession(req, user, { type: 'success', text: req.t('flash.registered') });
  return res.redirect('/dashboard');
};

const handleLogout = async (req, res) => {
  await endSession(req, res);
  res.redirect('/?signedOut=1');
};

const renderForgotPassword = (req, res) => {
  res.render('pages/auth/forgot-password', { title: req.t('auth.forgot.title') });
};

// Same message whether or not the address has an account.
const handleForgotPassword = (req, res) => {
  const { error, value } = validate(authValidation.forgotPassword.body, req.body);
  if (error) {
    rememberInput(req, { email: typed(req, 'email', 254) });
    flash(req, 'error', 'fieldErrors.email');
    return res.redirect('/forgot-password');
  }
  authService.requestPasswordReset(value.email, requestContext(req));
  flash(req, 'info', 'flash.resetRequested', { minutes: config.auth.resetPasswordExpirationMinutes });
  return res.redirect('/login');
};

const invalidLink = (req, res, target) => {
  flash(req, 'error', 'flash.linkInvalid');
  return res.redirect(target);
};

const renderResetPassword = async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!(await tokenService.findEmailToken(token, tokenTypes.RESET_PASSWORD))) {
    return invalidLink(req, res, '/forgot-password');
  }
  return res.render('pages/auth/reset-password', { title: req.t('auth.reset.title'), token });
};

const handleResetPassword = async (req, res) => {
  const { error, value } = validate(authValidation.resetPasswordForm.body, req.body);
  if (error) {
    if (error.details.some((detail) => detail.path[0] === 'token')) {
      return invalidLink(req, res, '/forgot-password');
    }
    addFlashMessage(req, { type: 'error', text: describeFormErrors(error, req.t) });
    return res.redirect(`/reset-password?token=${encodeURIComponent(value.token)}`);
  }
  try {
    await authService.resetPassword(value.token, value.password, requestContext(req));
  } catch (err) {
    if (err.statusCode === httpStatus.BAD_REQUEST) {
      return invalidLink(req, res, '/forgot-password');
    }
    throw err;
  }
  await resetSession(req, { type: 'success', text: req.t('flash.passwordReset') });
  return res.redirect('/login');
};

const afterVerification = (req) => (req.session.user ? '/dashboard' : '/login');

// GET only shows a button: link scanners in mail systems open links, and that must not confirm anything.
const renderVerifyEmail = async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!(await tokenService.findEmailToken(token, tokenTypes.VERIFY_EMAIL))) {
    return invalidLink(req, res, afterVerification(req));
  }
  return res.render('pages/auth/verify-email', { title: req.t('auth.verify.title'), token });
};

const handleVerifyEmail = async (req, res) => {
  const { error, value } = validate(authValidation.verifyEmail.body, req.body);
  if (error) {
    return invalidLink(req, res, afterVerification(req));
  }
  let user;
  try {
    user = await authService.verifyEmail(value.token, requestContext(req));
  } catch (err) {
    if (err.statusCode === httpStatus.BAD_REQUEST) {
      return invalidLink(req, res, afterVerification(req));
    }
    throw err;
  }
  if (req.session.user?.id === user.id) {
    req.session.user = userService.toUserResponse(user);
  }
  flash(req, 'success', 'flash.emailVerified');
  return res.redirect(afterVerification(req));
};

module.exports = {
  renderLogin,
  renderRegister,
  handleLogin,
  renderTwoFactor,
  handleTwoFactor,
  handleTwoFactorPasskey,
  handleRegister,
  handleLogout,
  renderForgotPassword,
  handleForgotPassword,
  renderResetPassword,
  handleResetPassword,
  renderVerifyEmail,
  handleVerifyEmail,
};
