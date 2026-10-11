const Joi = require('joi');
const { roles } = require('../config/roles');
const { objectId, fields } = require('./custom.validation');

const userId = Joi.object().keys({
  userId: Joi.string().required().custom(objectId),
});

const createUser = {
  body: Joi.object().keys({
    name: fields.name().required(),
    email: fields.email().required(),
    password: fields.newPassword().required(),
    role: Joi.string()
      .valid(...roles)
      .default('user'),
  }),
};

const getUsers = {
  query: Joi.object().keys({
    role: Joi.string().valid(...roles),
    search: Joi.string().trim().max(100).allow(''),
    sortBy: Joi.string().pattern(/^(name|email|role|createdAt|updatedAt):(asc|desc)$/),
    limit: Joi.number().integer().min(1).max(100).default(10),
    page: Joi.number().integer().min(1).max(10000).default(1),
  }),
};

const getUser = {
  params: userId,
};

const updateUser = {
  params: userId,
  body: Joi.object()
    .keys({
      name: fields.name(),
      email: fields.email(),
      password: fields.newPassword(),
      role: Joi.string().valid(...roles),
    })
    .min(1),
};

const deleteUser = {
  params: userId,
};

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
};
