const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./swaggerDef');
const config = require('../config/config');

const options = {
  definition: swaggerDefinition,
  apis: [path.join(__dirname, '../routes/v1/*.js')],
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app) => {
  if (config.env === 'test') {
    return;
  }
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = {
  setupSwagger,
  swaggerSpec,
};
