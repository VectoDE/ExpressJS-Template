const path = require('node:path');
const express = require('express');
const request = require('supertest');
const ApiError = require('../../src/utils/ApiError');
const { errorConverter, errorHandler } = require('../../src/middlewares/error');
const { viewDefaults } = require('../../src/middlewares/viewLocals');

const appThrowing = (error, views = path.join(__dirname, '../../src/views')) => {
  const app = express();
  app.set('views', views);
  app.set('view engine', 'ejs');
  app.locals.app = { name: 'Test', version: null };
  app.locals.docsEnabled = false;
  app.use(viewDefaults);
  app.get(['/v1/boom', '/boom'], () => {
    throw error;
  });
  app.use(errorConverter);
  app.use(errorHandler);
  return app;
};

describe('error handling', () => {
  it('hides internal error messages behind a generic 500', async () => {
    const res = await request(appThrowing(new Error('connect ECONNREFUSED mongodb://admin:hunter2@db')))
      .get('/v1/boom')
      .expect(500);
    expect(res.body).toEqual({ code: 500, message: 'Internal Server Error' });
  });

  it('maps duplicate keys to 409 and cast errors to 400', async () => {
    const duplicate = Object.assign(new Error('E11000 duplicate key error collection: users'), { code: 11000 });
    const cast = Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' });
    expect((await request(appThrowing(duplicate)).get('/v1/boom').expect(409)).body.message).toBe(
      'Resource already exists'
    );
    expect((await request(appThrowing(cast)).get('/v1/boom').expect(400)).body.message).toBe('Invalid request data');
  });

  it('keeps messages of operational errors', async () => {
    const res = await request(appThrowing(new ApiError(404, 'User not found')))
      .get('/v1/boom')
      .expect(404);
    expect(res.body.message).toBe('User not found');
  });

  it('renders an HTML page without stack trace for browsers', async () => {
    const res = await request(appThrowing(new Error('secret detail')))
      .get('/boom')
      .set('Accept', 'text/html')
      .expect(500);
    expect(res.text).toContain('Etwas ist schiefgelaufen');
    expect(res.text).not.toContain('secret detail');
    expect(res.text).not.toContain('at ');
  });

  it('answers CSRF failures with 403 for API clients and browsers', async () => {
    const csrf = Object.assign(new ApiError(403, 'Invalid CSRF token'), { code: 'EBADCSRFTOKEN' });
    await request(appThrowing(csrf)).get('/v1/boom').expect(403);
    const html = await request(appThrowing(csrf)).get('/boom').set('Accept', 'text/html').expect(403);
    expect(html.text).toContain('Zugriff verweigert');
  });

  it('falls back to plain text when the error page itself cannot be rendered', async () => {
    const res = await request(appThrowing(new Error('boom'), path.join(__dirname, 'missing-views')))
      .get('/boom')
      .set('Accept', 'text/html')
      .expect(500);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('Etwas ist schiefgelaufen');
    expect(res.text).not.toContain('missing-views');
  });
});
