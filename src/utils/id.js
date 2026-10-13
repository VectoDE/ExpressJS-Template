// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const crypto = require('node:crypto');

/**
 * Record ids for every database: 24 hex characters, the same format as a MongoDB ObjectId (4 bytes of seconds
 * since 1970, then 8 random bytes). Ids sort roughly by creation time, and data created with MongoDB keeps working.
 */
const ID_PATTERN = /^[a-f\d]{24}$/;

const newId = () => {
  const time = Buffer.alloc(4);
  time.writeUInt32BE(Math.floor(Date.now() / 1000));
  return Buffer.concat([time, crypto.randomBytes(8)]).toString('hex');
};

const isId = (value) => typeof value === 'string' && ID_PATTERN.test(value);

module.exports = { newId, isId, ID_PATTERN };
