// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { monitorEventLoopDelay } = require('node:perf_hooks');

/**
 * Minimal Prometheus metrics without a client library: request counts and durations per route,
 * plus process health. Labels only use the route pattern, never the raw URL, so ids and tokens
 * do not end up in the metrics and the number of series stays bounded.
 */
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const requests = new Map();
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();

const escapeLabel = (value) =>
  String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', String.raw`\"`)
    .replaceAll('\n', String.raw`\n`);

const observe = ({ method, route, status, seconds }) => {
  const key = `${method}|${route}|${status}`;
  let series = requests.get(key);
  if (!series) {
    series = { method, route, status, count: 0, sum: 0, buckets: BUCKETS.map(() => 0) };
    requests.set(key, series);
  }
  series.count += 1;
  series.sum += seconds;
  BUCKETS.forEach((bound, index) => {
    if (seconds <= bound) {
      series.buckets[index] += 1;
    }
  });
};

// Route pattern of the matched handler, or a fixed label for requests that matched nothing.
const routeOf = (req) => {
  if (req.route?.path) {
    return `${req.baseUrl}${req.route.path}`;
  }
  if (req.originalUrl.startsWith('/assets/')) {
    return '/assets/*';
  }
  return 'unmatched';
};

const middleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    observe({ method: req.method, route: routeOf(req), status: res.statusCode, seconds });
  });
  next();
};

const render = () => {
  const lines = ['# HELP http_requests_total Completed HTTP requests.', '# TYPE http_requests_total counter'];
  const histogram = [
    '# HELP http_request_duration_seconds Duration of HTTP requests.',
    '# TYPE http_request_duration_seconds histogram',
  ];
  requests.forEach((series) => {
    const labels = `method="${escapeLabel(series.method)}",route="${escapeLabel(series.route)}",status="${series.status}"`;
    lines.push(`http_requests_total{${labels}} ${series.count}`);
    series.buckets.forEach((count, index) => {
      histogram.push(`http_request_duration_seconds_bucket{${labels},le="${BUCKETS[index]}"} ${count}`);
    });
    histogram.push(
      `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${series.count}`,
      `http_request_duration_seconds_sum{${labels}} ${series.sum}`,
      `http_request_duration_seconds_count{${labels}} ${series.count}`
    );
  });
  const memory = process.memoryUsage();
  const process_ = [
    '# HELP process_resident_memory_bytes Resident memory size in bytes.',
    '# TYPE process_resident_memory_bytes gauge',
    `process_resident_memory_bytes ${memory.rss}`,
    '# HELP nodejs_heap_used_bytes V8 heap in use.',
    '# TYPE nodejs_heap_used_bytes gauge',
    `nodejs_heap_used_bytes ${memory.heapUsed}`,
    '# HELP nodejs_eventloop_delay_p99_seconds 99th percentile of the event loop delay.',
    '# TYPE nodejs_eventloop_delay_p99_seconds gauge',
    `nodejs_eventloop_delay_p99_seconds ${eventLoop.percentile(99) / 1e9}`,
    '# HELP process_uptime_seconds Process uptime.',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${process.uptime()}`,
  ];
  return `${[...lines, ...histogram, ...process_].join('\n')}\n`;
};

const reset = () => requests.clear();

module.exports = { middleware, render, reset, routeOf };
