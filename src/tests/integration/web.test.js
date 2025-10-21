const request = require('supertest');
const app = require('../../app');

describe('Web interface', () => {
  it('renders the landing page with HTML', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/html/);
    expect(response.text).toContain('Enterprise Express.js');
  });

  it('redirects unauthenticated users to the login screen', async () => {
    const response = await request(app).get('/dashboard');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });
});
