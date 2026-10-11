// Runs before every test file. Fixed values keep tests deterministic; none of them is used outside tests.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-key-4f9c1e7a2b8d6035e1c9a7f4b2d8e6c0';
process.env.SESSION_SECRET = 'test-only-session-key-9a3e5c7b1d2f4068a9c3e5b7d1f2a4c6';
process.env.CORS_ORIGIN = 'https://app.example.com';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '1000';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '100000';
process.env.LOGIN_MAX_ATTEMPTS = '3';
process.env.API_DOCS_ENABLED = 'true';
