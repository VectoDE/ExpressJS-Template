// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Imported first by worker/index.mjs. The browser build of readable-stream (pulled in by winston) asks
 * util.debuglog('stream') for a logger, and in the Workers runtime that logger writes every stream step to the
 * console. Node only does that with NODE_DEBUG=stream, so the same rule applies here.
 */
const util = require('node:util');

const original = util.debuglog;
const silent = Object.assign(() => {}, { enabled: false });

util.debuglog = (section, ...rest) =>
  String(process.env.NODE_DEBUG || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .includes(String(section).toLowerCase())
    ? original.call(util, section, ...rest)
    : silent;
