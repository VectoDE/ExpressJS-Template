const config = require('../../config/config');
const accountService = require('../../services/account.service');
const authService = require('../../services/auth.service');
const twoFactorService = require('../../services/twoFactor.service');
const passkeyService = require('../../services/passkey.service');
const i18n = require('../../i18n');
const accountValidation = require('../../validations/account.validation');
const httpStatus = require('../../utils/httpStatus');
const { addFlashMessage } = require('../../utils/flash');
const describeFormErrors = require('../../utils/formErrors');
const requestContext = require('../../utils/requestContext');
const safeRedirect = require('../../utils/safeRedirect');
const { startSession, endSession } = require('../../utils/webSession');

const validate = (schema, payload) => schema.validate(payload, { abortEarly: false, stripUnknown: true });

const back = (res, anchor = '') => res.redirect(`/dashboard${anchor}`);
const flash = (req, type, key, vars) => addFlashMessage(req, { type, text: req.t(key, vars) });

/**
 * Runs a service call and turns expected failures into a message on the dashboard.
 * `known` maps a status code (or a status and message) to a text key; anything else reaches the error handler.
 */
const attempt = async (req, res, anchor, known, action) => {
  try {
    return { ok: true, value: await action() };
  } catch (err) {
    const key = known[`${err.statusCode}:${err.message}`] || known[err.statusCode];
    if (!key) {
      throw err;
    }
    flash(req, 'error', key);
    back(res, anchor);
    return { ok: false };
  }
};

const renderDashboard = async (req, res) => {
  const user = req.currentUserDoc;
  const [sessions, activity, passkeys] = await Promise.all([
    accountService.listSessions(user.id),
    accountService.listActivity(user.id, 10),
    passkeyService.list(user.id),
  ]);
  // Recovery codes are shown exactly once, right after they were created.
  const recoveryCodes = req.session.recoveryCodes || null;
  delete req.session.recoveryCodes;
  res.render('pages/account/dashboard', {
    title: req.t('account.title'),
    user: res.locals.currentUser,
    twoFactor: twoFactorService.status(user),
    pendingSetup: twoFactorService.pendingSetup(user),
    recoveryCodes,
    passkeys,
    maxPasskeys: passkeyService.MAX_PASSKEYS,
    // Options of a started "add passkey", until the browser answered or the five minutes are over.
    passkeyOptions: req.session.passkeyOptions || null,
    scripts: ['passkeys'],
    sessions,
    activity,
    retentionDays: config.audit.retentionDays,
  });
};

const downloadExport = async (req, res) => {
  const data = await accountService.exportData(req.session.user.id);
  res.attachment('account-export.json');
  res.type('application/json').send(JSON.stringify(data, null, 2));
};

/**
 * Runs a credential-relevant change. On success the browser gets a fresh session, because the change
 * invalidates every session that was started before it (see ensureAuthenticated).
 */
const applyChange = async (req, res, change, successKey) => {
  const result = await attempt(
    req,
    res,
    '',
    { [httpStatus.FORBIDDEN]: 'flash.passwordWrong', [httpStatus.CONFLICT]: 'flash.emailUnavailable' },
    change
  );
  if (!result.ok) {
    return undefined;
  }
  await startSession(req, result.value, { type: 'success', text: req.t(successKey) });
  return back(res);
};

// Rectification (Art. 16 GDPR). Only fields that actually changed are sent to the service.
const handleProfile = async (req, res) => {
  const current = res.locals.currentUser;
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '')
    .trim()
    .toLowerCase();
  const changes = {};
  if (name !== current.name) {
    changes.name = name;
  }
  if (email !== current.email) {
    if (!req.body.currentPassword) {
      flash(req, 'error', 'flash.emailNeedsPassword');
      return back(res);
    }
    changes.email = email;
    changes.currentPassword = req.body.currentPassword;
  }
  if (!Object.keys(changes).length) {
    flash(req, 'info', 'flash.profileUnchanged');
    return back(res);
  }

  const { error, value } = accountValidation.updateProfile.body.validate(changes, { abortEarly: false });
  if (error) {
    addFlashMessage(req, { type: 'error', text: describeFormErrors(error, req.t) });
    return back(res);
  }
  return applyChange(
    req,
    res,
    () => accountService.updateProfile(current.id, value, requestContext(req)),
    changes.email ? 'flash.profileEmailChanged' : 'flash.profileSaved'
  );
};

const handlePassword = async (req, res) => {
  const { error, value } = validate(accountValidation.changePassword.body, req.body);
  if (error) {
    addFlashMessage(req, { type: 'error', text: describeFormErrors(error, req.t) });
    return back(res);
  }
  const { password, currentPassword } = value;
  return applyChange(
    req,
    res,
    () => accountService.updateProfile(res.locals.currentUser.id, { password, currentPassword }, requestContext(req)),
    'flash.passwordChanged'
  );
};

const handleResendVerification = async (req, res) => {
  const sent = await authService.sendVerificationEmail(req.currentUserDoc);
  flash(req, sent ? 'success' : 'info', sent ? 'flash.verificationSent' : 'flash.alreadyVerified');
  return back(res);
};

const TWO_FACTOR = '#two-factor';

const handleTwoFactorSetup = async (req, res) => {
  const { error, value } = validate(accountValidation.setupTwoFactor.body, req.body);
  if (error) {
    flash(req, 'error', 'fieldErrors.currentPassword');
    return back(res, TWO_FACTOR);
  }
  const result = await attempt(
    req,
    res,
    TWO_FACTOR,
    { [httpStatus.FORBIDDEN]: 'flash.passwordWrong', [httpStatus.CONFLICT]: 'flash.twoFactorAlreadyEnabled' },
    () => twoFactorService.startSetup(req.currentUserDoc.id, value.password)
  );
  if (result.ok) {
    flash(req, 'info', 'flash.twoFactorSetupStarted');
    back(res, TWO_FACTOR);
  }
};

const showRecoveryCodes = (req, res, codes, key) => {
  req.session.recoveryCodes = codes;
  flash(req, 'success', key);
  return back(res, '#recovery-codes');
};

const handleTwoFactorEnable = async (req, res) => {
  const { error, value } = validate(accountValidation.enableTwoFactor.body, req.body);
  if (error) {
    flash(req, 'error', 'flash.twoFactorCodeInvalid');
    return back(res, TWO_FACTOR);
  }
  const result = await attempt(
    req,
    res,
    TWO_FACTOR,
    {
      [`${httpStatus.BAD_REQUEST}:Start the two-factor setup first`]: 'flash.twoFactorNotPending',
      [httpStatus.BAD_REQUEST]: 'flash.twoFactorCodeInvalid',
      [httpStatus.CONFLICT]: 'flash.twoFactorAlreadyEnabled',
    },
    () => twoFactorService.enable(req.currentUserDoc.id, value.code, requestContext(req))
  );
  if (result.ok) {
    showRecoveryCodes(req, res, result.value, 'flash.twoFactorEnabled');
  }
};

const handleTwoFactorDisable = async (req, res) => {
  const { error, value } = validate(accountValidation.disableTwoFactor.body, req.body);
  if (error) {
    addFlashMessage(req, { type: 'error', text: describeFormErrors(error, req.t) });
    return back(res, TWO_FACTOR);
  }
  const result = await attempt(
    req,
    res,
    TWO_FACTOR,
    {
      [`${httpStatus.FORBIDDEN}:Current password is incorrect`]: 'flash.passwordWrong',
      [httpStatus.FORBIDDEN]: 'flash.twoFactorCodeInvalid',
      [httpStatus.BAD_REQUEST]: 'flash.twoFactorDisabled',
    },
    () => twoFactorService.disable(req.currentUserDoc.id, value, requestContext(req))
  );
  if (result.ok) {
    flash(req, 'success', 'flash.twoFactorDisabled');
    back(res, TWO_FACTOR);
  }
};

const handleRecoveryCodes = async (req, res) => {
  const { error, value } = validate(accountValidation.recoveryCodes.body, req.body);
  if (error) {
    flash(req, 'error', 'flash.twoFactorCodeInvalid');
    return back(res, TWO_FACTOR);
  }
  const result = await attempt(
    req,
    res,
    TWO_FACTOR,
    { [httpStatus.FORBIDDEN]: 'flash.twoFactorCodeInvalid', [httpStatus.BAD_REQUEST]: 'flash.twoFactorNotPending' },
    () => twoFactorService.regenerateRecoveryCodes(req.currentUserDoc.id, value.code)
  );
  if (result.ok) {
    showRecoveryCodes(req, res, result.value, 'flash.recoveryCodesRenewed');
  }
};

const PASSKEYS = '#passkeys';

// First step: the password unlocks the options for navigator.credentials.create(), kept in the session.
const handlePasskeyOptions = async (req, res) => {
  const { error, value } = validate(accountValidation.passkeyOptions.body, req.body);
  if (error) {
    flash(req, 'error', 'fieldErrors.currentPassword');
    return back(res, PASSKEYS);
  }
  const result = await attempt(
    req,
    res,
    PASSKEYS,
    {
      [httpStatus.FORBIDDEN]: 'flash.passwordWrong',
      [httpStatus.BAD_REQUEST]: 'flash.passkeyNeedsTwoFactor',
      [httpStatus.CONFLICT]: 'flash.passkeyLimit',
    },
    () => passkeyService.registrationOptions(req.currentUserDoc.id, value.password)
  );
  if (result.ok) {
    req.session.passkeyOptions = result.value;
    flash(req, 'info', 'flash.passkeyReady');
    back(res, PASSKEYS);
  }
};

// Second step: the browser posts the new credential as JSON in the form field "response".
const handlePasskeyAdd = async (req, res) => {
  delete req.session.passkeyOptions;
  const { error, value } = validate(accountValidation.addPasskeyForm.body, req.body);
  if (error) {
    flash(req, 'error', 'flash.passkeyInvalid');
    return back(res, PASSKEYS);
  }
  const result = await attempt(
    req,
    res,
    PASSKEYS,
    { [httpStatus.BAD_REQUEST]: 'flash.passkeyInvalid', [httpStatus.CONFLICT]: 'flash.passkeyLimit' },
    () => passkeyService.register(req.currentUserDoc.id, value, requestContext(req))
  );
  if (result.ok) {
    flash(req, 'success', 'flash.passkeyAdded', { name: result.value.name });
    back(res, PASSKEYS);
  }
};

// A passkey that is already gone counts as removed, so the message is the same either way.
const handlePasskeyRemove = async (req, res) => {
  const { error, value } = accountValidation.passkeyId.params.validate(req.params);
  if (!error) {
    try {
      await passkeyService.remove(req.currentUserDoc.id, value.passkeyId, requestContext(req));
    } catch (err) {
      if (err.statusCode !== httpStatus.NOT_FOUND) {
        throw err;
      }
    }
  }
  flash(req, 'success', 'flash.passkeyRemoved');
  return back(res, PASSKEYS);
};

// A session that is already gone counts as ended, so the message is the same either way.
const handleRevokeSession = async (req, res) => {
  const { error, value } = accountValidation.sessionId.params.validate(req.params);
  if (!error) {
    try {
      await accountService.revokeSession(req.currentUserDoc.id, value.sessionId, requestContext(req));
    } catch (err) {
      if (err.statusCode !== httpStatus.NOT_FOUND) {
        throw err;
      }
    }
  }
  flash(req, 'success', 'flash.sessionRevoked');
  return back(res, '#sessions');
};

// Signs out every other browser and API client; this browser continues with a fresh session.
const handleRevokeAllSessions = async (req, res) => {
  const user = await accountService.revokeAllSessions(req.currentUserDoc.id, requestContext(req));
  await startSession(req, user, { type: 'success', text: req.t('flash.allSessionsRevoked') });
  return back(res, '#sessions');
};

// Erasure (Art. 17 GDPR): account, API tokens, activity log and this session are removed immediately.
const handleDelete = async (req, res) => {
  const { error, value } = validate(accountValidation.deleteAccount.body, req.body);
  if (error) {
    flash(req, 'error', 'flash.deletePasswordMissing');
    return back(res);
  }
  const result = await attempt(req, res, '', { [httpStatus.FORBIDDEN]: 'flash.deletePasswordWrong' }, () =>
    accountService.deleteAccount(req.session.user.id, value.password)
  );
  if (!result.ok) {
    return undefined;
  }
  await endSession(req, res);
  return res.redirect('/?deleted=1');
};

/**
 * Language switch in the footer, for guests and signed-in users. A plain link, so visitors who never
 * switch get no cookie. The session cookie is SameSite=Strict, so a link on another site cannot change
 * the stored language of an account. Signed in, the choice is stored with the account for emails too.
 */
const handleLanguage = async (req, res) => {
  const { error, value } = accountValidation.language.validate(
    { locale: req.params.locale, returnTo: req.query.returnTo },
    { stripUnknown: true }
  );
  const target = safeRedirect(req.query.returnTo, '/');
  if (error) {
    return res.redirect(target);
  }
  req.session.locale = value.locale;
  if (req.session.user) {
    await accountService.setLocale(req.session.user.id, value.locale);
    req.session.user = { ...req.session.user, locale: value.locale };
  }
  addFlashMessage(req, { type: 'success', text: i18n.forLocale(value.locale).t('flash.languageChanged') });
  return res.redirect(target);
};

module.exports = {
  renderDashboard,
  downloadExport,
  handleProfile,
  handlePassword,
  handleResendVerification,
  handleTwoFactorSetup,
  handleTwoFactorEnable,
  handleTwoFactorDisable,
  handleRecoveryCodes,
  handlePasskeyOptions,
  handlePasskeyAdd,
  handlePasskeyRemove,
  handleRevokeSession,
  handleRevokeAllSessions,
  handleDelete,
  handleLanguage,
};
