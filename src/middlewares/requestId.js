// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const crypto = require('node:crypto');

// Accept an incoming id from a proxy or client only if it is short and harmless; otherwise make a new one.
const VALID_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Every request gets an id that appears in the X-Request-Id response header, in every log line
 * and on error pages, so a report from a user can be matched to the server log.
 */
const requestId = (req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
};

module.exports = requestId;
