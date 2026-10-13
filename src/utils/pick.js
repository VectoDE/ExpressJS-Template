// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && Object.hasOwn(object, key)) {
      obj[key] = object[key];
    }
    return obj;
  }, {});
};

module.exports = pick;
