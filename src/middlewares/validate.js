// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const Joi = require('joi');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');

/**
 * Validates params, query and body. Unknown keys are rejected and the validated values
 * replace the raw input, so handlers only ever see data that passed the schema.
 */
const validate = (schema) => (req, res, next) => {
  const validSchema = pick(schema, ['params', 'query', 'body']);
  // Not pick(): in Express 5 req.query is an inherited getter, not an own property.
  const object = Object.fromEntries(Object.keys(validSchema).map((key) => [key, req[key]]));
  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' }, abortEarly: false, allowUnknown: false })
    .validate(object);

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
  }

  Object.keys(value).forEach((key) => {
    // Express 5 exposes req.query as a getter; an own property shadows it with the validated copy.
    Object.defineProperty(req, key, { value: value[key], writable: true, enumerable: true, configurable: true });
  });
  return next();
};

module.exports = validate;
