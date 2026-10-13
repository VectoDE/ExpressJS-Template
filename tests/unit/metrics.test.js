// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const metrics = require('../../src/utils/metrics');

const finish = (req, statusCode, delayMs = 0) =>
  new Promise((resolve) => {
    const listeners = {};
    const res = { statusCode, on: (event, fn) => (listeners[event] = fn) };
    metrics.middleware(req, res, () => {
      setTimeout(() => {
        listeners.finish();
        resolve();
      }, delayMs);
    });
  });

describe('metrics', () => {
  beforeEach(() => metrics.reset());

  it('labels by route pattern, never by the raw URL', async () => {
    await finish(
      { method: 'GET', baseUrl: '/v1/users', route: { path: '/:userId' }, originalUrl: '/v1/users/abc' },
      200
    );
    await finish({ method: 'GET', originalUrl: '/assets/css/base.css' }, 200);
    await finish({ method: 'GET', originalUrl: '/does/not/exist?token=secret' }, 404);
    const text = metrics.render();
    expect(text).toContain('http_requests_total{method="GET",route="/v1/users/:userId",status="200"} 1');
    expect(text).toContain('route="/assets/*"');
    expect(text).toContain('route="unmatched",status="404"');
    expect(text).not.toContain('abc');
    expect(text).not.toContain('secret');
  });

  it('renders a valid histogram and process gauges', async () => {
    await finish(
      { method: 'POST', baseUrl: '/v1/auth', route: { path: '/login' }, originalUrl: '/v1/auth/login' },
      200,
      5
    );
    const text = metrics.render();
    expect(text).toMatch(/http_request_duration_seconds_bucket\{[^}]*le="\+Inf"\} 1/);
    expect(text).toMatch(/http_request_duration_seconds_count\{[^}]*\} 1/);
    expect(text).toMatch(/^process_resident_memory_bytes \d+$/m);
    expect(text).toMatch(/^nodejs_eventloop_delay_p99_seconds [\d.e-]+$/m);
    expect(text.endsWith('\n')).toBe(true);
  });
});
