const config = require('../config/config');

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Express Enterprise Template API',
    version: '1.0.0',
    description:
      'Robust Express.js starter kit with authentication, validation, logging, and testing tooling.',
  },
  servers: [
    {
      url: `http://localhost:${config.port}/v1`,
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      RegisterUser: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          password: {
            type: 'string',
            minLength: 8,
          },
          role: {
            type: 'string',
            enum: ['user', 'admin'],
          },
        },
      },
      LoginUser: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
          },
          password: {
            type: 'string',
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};
