// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * Turns a Joi validation error into user-facing messages, one per failed field and in the UI language.
 * Raw Joi messages are English and name internal keys, so they never reach the browser.
 */
const describeFormErrors = (error, t) => {
  const fields = [...new Set(error.details.map((detail) => detail.path[0]))];
  return fields
    .map((field) => {
      const text = t(`fieldErrors.${field}`);
      return text === `fieldErrors.${field}` ? t('fallbackFieldError') : text;
    })
    .join(' ');
};

module.exports = describeFormErrors;
