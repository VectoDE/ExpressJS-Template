// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./swaggerDef');
const config = require('../config/config');

const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  // Listed one by one so the docs show the tags in a logical order. Paths need forward slashes, also on Windows.
  apis: ['auth', 'account', 'user'].map((name) =>
    path.join(__dirname, `../routes/v1/${name}.route.js`).replaceAll('\\', '/')
  ),
});

/**
 * Off by default in production (API_DOCS_ENABLED). Swagger UI needs inline styles,
 * so only /docs gets that exception in its Content Security Policy.
 */
const setupSwagger = (app) => {
  if (!config.docsEnabled) {
    return;
  }
  app.get('/docs/openapi.json', (req, res) => res.json(swaggerSpec));
  app.use(
    '/docs',
    (req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
      );
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Express.js Template API' })
  );
};

module.exports = {
  setupSwagger,
  swaggerSpec,
};
