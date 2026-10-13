// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Replaces the ejs package in the Worker bundle. EJS compiles templates with `new Function`, which Workers
 * forbid; this serves the views precompiled at build time instead (worker/precompile-views.js).
 */
const templates = require('../../worker-dist/views');
const { createViewEngine } = require('../view-engine');

const viewEngine = createViewEngine(templates);

module.exports = {
  renderFile: viewEngine.renderFile,
  __express: viewEngine.engine,
  viewEngine,
};
