const Joi = require('joi');
const { objectId, password } = require('./custom.validation');

const createUser = {
  body: Joi.object().keys({
    name: Joi.string().trim().min(3).max(120).required(),
    email: Joi.string().email().required(),
    password: Joi.string().required().custom(password),
    role: Joi.string().valid('user', 'admin').default('user'),
  }),
};

const getUsers = {
  query: Joi.object().keys({
    role: Joi.string().valid('user', 'admin'),
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100).default(10),
    page: Joi.number().integer().min(1).default(1),
  }),
};

const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().trim().min(3).max(120),
      email: Joi.string().email(),
      password: Joi.string().custom(password),
      role: Joi.string().valid('user', 'admin'),
    })
    .min(1),
};

const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
};

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
};
