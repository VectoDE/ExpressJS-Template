const request = require('supertest');
const app = require('../../app');

describe('Health check', () => {
  it('should return service status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
      })
    );
  });
});
