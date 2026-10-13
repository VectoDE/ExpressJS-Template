// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const Joi = require('joi');
const { roles } = require('../../config/roles');
const userService = require('../../services/user.service');
const accountService = require('../../services/account.service');
const twoFactorService = require('../../services/twoFactor.service');
const ApiError = require('../../utils/ApiError');
const httpStatus = require('../../utils/httpStatus');
const { addFlashMessage } = require('../../utils/flash');
const describeFormErrors = require('../../utils/formErrors');
const requestContext = require('../../utils/requestContext');
const { objectId, fields } = require('../../validations/custom.validation');

const PAGE_SIZE = 20;

// Filters come from the address bar; anything invalid falls back to the unfiltered first page.
const listQuery = Joi.object({
  q: Joi.string().trim().max(100).allow('').default(''),
  role: Joi.string()
    .valid(...roles, '')
    .default(''),
  page: Joi.number().integer().min(1).max(10000).default(1),
});

const editForm = Joi.object({
  name: fields.name().required(),
  role: Joi.string()
    .valid(...roles)
    .required(),
});

const flash = (req, type, key, vars) => addFlashMessage(req, { type, text: req.t(key, vars) });

const loadUser = async (req) => {
  const { error } = Joi.string().custom(objectId).validate(req.params.userId);
  const user = error ? null : await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

const listUsers = async (req, res) => {
  const { error, value } = listQuery.validate(req.query, { stripUnknown: true, convert: true });
  const query = error ? { q: '', role: '', page: 1 } : value;
  const result = await userService.queryUsers(
    { search: query.q, role: query.role },
    { page: query.page, limit: PAGE_SIZE, sortBy: 'createdAt:desc' }
  );
  const pageUrl = (page) => {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.role) params.set('role', query.role);
    if (page > 1) params.set('page', String(page));
    const search = params.toString();
    return search ? `/admin/users?${search}` : '/admin/users';
  };
  res.render('pages/admin/users', { title: req.t('admin.title'), result, filters: query, pageUrl });
};

const renderUser = async (req, res) => {
  const user = await loadUser(req);
  res.render('pages/admin/user', {
    title: req.t('admin.editTitle'),
    subject: userService.toUserResponse(user),
    twoFactor: twoFactorService.status(user),
    activity: await accountService.listActivity(user.id, 10),
    isSelf: user.id === req.currentUserDoc.id,
  });
};

// A new role ends all sessions of that account (credentialsChangedAt), so rights never lag behind.
const updateUser = async (req, res) => {
  const user = await loadUser(req);
  const back = () => res.redirect(`/admin/users/${user.id}`);
  const { error, value } = editForm.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    addFlashMessage(req, { type: 'error', text: describeFormErrors(error, req.t) });
    return back();
  }
  if (user.id === req.currentUserDoc.id && value.role !== user.role) {
    flash(req, 'error', 'flash.ownRole');
    return back();
  }
  const updated = await userService.updateUserById(user.id, value, requestContext(req));
  flash(req, 'success', 'flash.userSaved', { name: updated.name });
  return back();
};

// Typing the address again prevents deleting the wrong row by accident.
const deleteUser = async (req, res) => {
  const user = await loadUser(req);
  if (user.id === req.currentUserDoc.id) {
    flash(req, 'error', 'flash.ownAccount');
    return res.redirect(`/admin/users/${user.id}`);
  }
  if (
    String(req.body.confirmEmail ?? '')
      .trim()
      .toLowerCase() !== user.email
  ) {
    flash(req, 'error', 'admin.deleteMismatch');
    return res.redirect(`/admin/users/${user.id}`);
  }
  await userService.deleteUserById(user.id);
  flash(req, 'success', 'flash.userDeleted', { name: user.name });
  return res.redirect('/admin/users');
};

module.exports = { listUsers, renderUser, updateUser, deleteUser };
