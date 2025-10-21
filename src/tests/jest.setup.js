process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-change-me';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expressjs_template_test';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
