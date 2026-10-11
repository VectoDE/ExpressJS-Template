const { version } = require('../../package.json');

const error = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Express.js Template API',
    version,
    description: 'REST API with JWT access and refresh tokens, role-based access control and strict input validation.',
    license: { name: 'MIT', url: 'https://github.com/VectoDE/ExpressJS-Template/blob/main/LICENSE' },
  },
  servers: [{ url: '/v1', description: 'This server' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'integer' },
          message: { type: 'string' },
          requestId: { type: 'string', description: 'Also sent as X-Request-Id; quote it when reporting a problem' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['user', 'admin'] },
          isEmailVerified: { type: 'boolean' },
          locale: { type: 'string', enum: ['en', 'de'] },
          twoFactorEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Token: {
        type: 'object',
        properties: { token: { type: 'string' }, expires: { type: 'string', format: 'date-time' } },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          tokens: {
            type: 'object',
            properties: {
              access: { $ref: '#/components/schemas/Token' },
              refresh: { $ref: '#/components/schemas/Token' },
            },
          },
        },
      },
      RegisterUser: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 120 },
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: {
            type: 'string',
            minLength: 12,
            maxLength: 128,
            description: 'Upper and lower case letters, a digit and a symbol',
          },
          locale: { type: 'string', enum: ['en', 'de'], description: 'Language for emails' },
        },
      },
      CreateUser: {
        allOf: [
          { $ref: '#/components/schemas/RegisterUser' },
          { type: 'object', properties: { role: { type: 'string', enum: ['user', 'admin'] } } },
        ],
      },
      UpdateUser: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 120 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 12, maxLength: 128 },
          role: { type: 'string', enum: ['user', 'admin'] },
        },
      },
      LoginUser: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', maxLength: 128 },
        },
      },
      RefreshToken: {
        type: 'object',
        additionalProperties: false,
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
      TwoFactorChallenge: {
        type: 'object',
        properties: {
          twoFactorRequired: { type: 'boolean', enum: [true] },
          challengeToken: { type: 'string' },
          expiresIn: { type: 'integer', description: 'Seconds' },
        },
      },
      EmailToken: {
        type: 'object',
        additionalProperties: false,
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          device: { type: 'string', nullable: true, example: 'Firefox · Windows' },
          startedAt: { type: 'string', format: 'date-time' },
          lastRefreshedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      AuditEvent: {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'login' },
          device: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TwoFactorStatus: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          enabledAt: { type: 'string', format: 'date-time', nullable: true },
          recoveryCodesLeft: { type: 'integer' },
          setupPending: { type: 'boolean' },
        },
      },
    },
    responses: {
      BadRequest: error('Invalid input'),
      Unauthorized: error('Missing, invalid or expired token'),
      Forbidden: error('Not allowed for this role'),
      NotFound: error('Not found'),
      TooManyRequests: error('Rate limit reached'),
    },
  },
  security: [{ bearerAuth: [] }],
};
