// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const httpStatus = require('../utils/httpStatus');
const requestContext = require('../utils/requestContext');
const accountService = require('../services/account.service');
const twoFactorService = require('../services/twoFactor.service');
const passkeyService = require('../services/passkey.service');
const userService = require('../services/user.service');

const exportData = async (req, res) => {
  const data = await accountService.exportData(req.user.id);
  res.attachment('account-export.json');
  res.status(httpStatus.OK).json(data);
};

const updateProfile = async (req, res) => {
  const user = await accountService.updateProfile(req.user.id, req.body, requestContext(req));
  res.status(httpStatus.OK).json({ user: userService.toUserResponse(user) });
};

const deleteAccount = async (req, res) => {
  await accountService.deleteAccount(req.user.id, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
};

const getSessions = async (req, res) => {
  res.status(httpStatus.OK).json({ results: await accountService.listSessions(req.user.id) });
};

const deleteSession = async (req, res) => {
  await accountService.revokeSession(req.user.id, req.params.sessionId, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

const deleteSessions = async (req, res) => {
  await accountService.revokeAllSessions(req.user.id, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

const getActivity = async (req, res) => {
  res.status(httpStatus.OK).json({ results: await accountService.listActivity(req.user.id, 50) });
};

const getTwoFactor = (req, res) => {
  res.status(httpStatus.OK).json(twoFactorService.status(req.user));
};

const setupTwoFactor = async (req, res) => {
  const { secret, otpauthUrl, qrSvg } = await twoFactorService.startSetup(req.user.id, req.body.password);
  res.status(httpStatus.OK).json({ secret, otpauthUrl, qrSvg });
};

const enableTwoFactor = async (req, res) => {
  const recoveryCodes = await twoFactorService.enable(req.user.id, req.body.code, requestContext(req));
  res.status(httpStatus.OK).json({ recoveryCodes });
};

const disableTwoFactor = async (req, res) => {
  await twoFactorService.disable(req.user.id, req.body, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

const renewRecoveryCodes = async (req, res) => {
  const recoveryCodes = await twoFactorService.regenerateRecoveryCodes(req.user.id, req.body.code);
  res.status(httpStatus.OK).json({ recoveryCodes });
};

const listPasskeys = async (req, res) => {
  res.json({ results: await passkeyService.list(req.user.id) });
};

const passkeyOptions = async (req, res) => {
  res.json(await passkeyService.registrationOptions(req.user.id, req.body.password));
};

const addPasskey = async (req, res) => {
  res.status(httpStatus.CREATED).json(await passkeyService.register(req.user.id, req.body, requestContext(req)));
};

const removePasskey = async (req, res) => {
  await passkeyService.remove(req.user.id, req.params.passkeyId, requestContext(req));
  res.status(httpStatus.NO_CONTENT).send();
};

module.exports = {
  exportData,
  updateProfile,
  deleteAccount,
  getSessions,
  deleteSession,
  deleteSessions,
  getActivity,
  getTwoFactor,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  renewRecoveryCodes,
  listPasskeys,
  passkeyOptions,
  addPasskey,
  removePasskey,
};
