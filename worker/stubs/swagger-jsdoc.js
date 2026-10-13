// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Replaces swagger-jsdoc in the Worker bundle. swagger-jsdoc reads the route files at run time, which a Worker
 * cannot do; scripts/build-worker.js runs the real swagger-jsdoc and stores the result.
 */
const spec = require('../../worker-dist/openapi.json');

module.exports = () => spec;
