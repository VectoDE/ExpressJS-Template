/**
 * Load test for every HTTP endpoint.
 *
 * Starts an in-memory MongoDB and the real server (NODE_ENV=production, encrypted session store),
 * prepares fresh tokens, sessions and users for endpoints that consume them, then measures each
 * endpoint with autocannon and checks status codes and latency budgets.
 *
 *   npm run test:perf                 all endpoints
 *   PERF_DURATION=10 npm run test:perf
 *   PERF_ONLY=auth npm run test:perf  only endpoints whose name contains "auth"
 *
 * Results: reports/performance.json and reports/performance.md. Exit code 1 if a budget is missed.
 */
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const autocannon = require('autocannon');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ROOT = path.join(__dirname, '../..');
const DURATION = Number(process.env.PERF_DURATION) || 5;
const ONLY = process.env.PERF_ONLY || '';

const isReady = async (base) => {
  try {
    return (await fetch(`${base}/health/ready`)).ok;
  } catch {
    return false; // not listening yet
  }
};

const waitForServer = async (base, child, attemptsLeft = 100) => {
  if (child.exitCode !== null) {
    throw new Error(`Server exited with code ${child.exitCode}`);
  }
  if (await isReady(base)) {
    return;
  }
  if (attemptsLeft <= 1) {
    throw new Error('Server did not become ready');
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  await waitForServer(base, child, attemptsLeft - 1);
};

// Endpoints are measured one after the other, so they never compete for the server.
const inSequence = (items, fn) =>
  items.reduce(async (previous, item) => [...(await previous), await fn(item)], Promise.resolve([]));

// The same secrets go to the server and to the helpers that sign tokens for it.
const serverEnv = (mongoUri, port) => ({
  NODE_ENV: 'production',
  PORT: String(port),
  MONGODB_URI: mongoUri,
  MONGODB_DB_NAME: 'perf',
  JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  SESSION_SECRET: crypto.randomBytes(48).toString('base64url'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
  APP_URL: 'https://app.example.com',
  // Nothing listens there: mails fail fast and are only logged, the measured responses do not wait for them.
  SMTP_URL: 'smtp://127.0.0.1:9',
  CORS_ORIGIN: 'https://app.example.com',
  API_DOCS_ENABLED: 'true',
  LOG_LEVEL: 'error',
  // Load tests come from one IP; the limiter itself is covered by the integration tests.
  RATE_LIMIT_MAX: '100000000',
  AUTH_RATE_LIMIT_MAX: '100000000',
  LOGIN_MAX_ATTEMPTS: '100',
  // Production runs behind a TLS proxy; the load test plays that proxy with X-Forwarded-Proto.
  TRUST_PROXY: '1',
});

const startServer = async (mongoUri) => {
  const port = 20000 + crypto.randomInt(20000);
  const settings = serverEnv(mongoUri, port);
  // The helpers in this process sign tokens, so they need exactly the server's settings.
  Object.assign(process.env, settings);
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: ROOT,
    env: { ...process.env, ...settings },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const base = `http://127.0.0.1:${port}`;
  await waitForServer(base, child);
  return { child, base };
};

const measure = (base, endpoint, ctx) =>
  new Promise((resolve, reject) => {
    const statuses = {};
    const options = {
      url: base,
      connections: endpoint.connections || 10,
      pipelining: 1,
      headers: { 'x-forwarded-proto': 'https' },
      timeout: 20,
      ...(endpoint.amount ? { amount: endpoint.amount(ctx) } : { duration: endpoint.duration || DURATION }),
      requests: [
        {
          method: endpoint.method,
          path: endpoint.path(ctx),
          setupRequest: (req) => {
            const extra = endpoint.request ? endpoint.request(ctx) : {};
            return { ...req, ...extra, headers: { ...req.headers, ...extra.headers } };
          },
        },
      ],
    };
    const instance = autocannon(options, (error, result) => (error ? reject(error) : resolve({ result, statuses })));
    instance.on('response', (client, statusCode) => {
      statuses[statusCode] = (statuses[statusCode] || 0) + 1;
    });
  });

const evaluate = (endpoint, { result, statuses }) => {
  const expected = endpoint.expect;
  const total = Object.values(statuses).reduce((sum, n) => sum + n, 0);
  const unexpected = Object.entries(statuses)
    .filter(([code]) => Number(code) !== expected)
    .reduce((sum, [, n]) => sum + n, 0);
  const p99 = result.latency.p99;
  const failures = [];
  if (total === 0) {
    failures.push('no responses');
  }
  if (unexpected > 0 || result.errors > 0 || result.timeouts > 0) {
    failures.push(`${unexpected} unexpected status, ${result.errors} errors, ${result.timeouts} timeouts`);
  }
  if (p99 > endpoint.p99) {
    failures.push(`p99 ${p99} ms > budget ${endpoint.p99} ms`);
  }
  return {
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.label || endpoint.path({ label: true }),
    requests: total,
    rps: Math.round(result.requests.average),
    p50: result.latency.p50,
    p90: result.latency.p90,
    p99,
    max: result.latency.max,
    budgetP99: endpoint.p99,
    statuses,
    passed: failures.length === 0,
    failures,
  };
};

const writeReport = (rows) => {
  const dir = path.join(ROOT, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    date: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };
  fs.writeFileSync(path.join(dir, 'performance.json'), JSON.stringify({ ...meta, results: rows }, null, 2));
  const lines = [
    '# Performance report',
    '',
    `${meta.date}, Node ${meta.node}, ${meta.platform}`,
    '',
    '| Endpoint | Requests | Req/s | p50 ms | p99 ms | Budget p99 | Result |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.map(
      (r) =>
        `| \`${r.method} ${r.path}\` | ${r.requests} | ${r.rps} | ${r.p50} | ${r.p99} | ${r.budgetP99} | ${
          r.passed ? 'pass' : `FAIL: ${r.failures.join('; ')}`
        } |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(dir, 'performance.md'), lines.join('\n'));
};

const main = async () => {
  const mongod = await MongoMemoryServer.create();
  const { child, base } = await startServer(mongod.getUri());
  const rows = [];
  let helpers;
  try {
    // Required only now: config reads the secrets that startServer placed in process.env.
    const { createHelpers } = require('./helpers');
    helpers = await createHelpers(base);
    const selected = require('./endpoints')(helpers).filter((e) => e.name.includes(ONLY));
    await inSequence(selected, async (endpoint) => {
      const ctx = endpoint.prepare ? await endpoint.prepare() : {};
      const row = evaluate(endpoint, await measure(base, endpoint, ctx));
      rows.push(row);
      const route = `${row.method} ${row.path}`;
      const verdict = row.passed ? 'PASS' : 'FAIL';
      const reasons = row.passed ? '' : '  ' + row.failures.join('; ');
      console.log(
        `${verdict}  ${route.padEnd(34)} ${String(row.rps).padStart(6)} req/s  p99 ${String(row.p99).padStart(5)} ms  (budget ${row.budgetP99})${reasons}`
      );
    });
  } finally {
    await helpers?.close();
    child.kill('SIGTERM');
    await mongod.stop();
  }
  writeReport(rows);
  const failed = rows.filter((r) => !r.passed);
  console.log(
    `\n${rows.length - failed.length}/${rows.length} endpoints within budget. Report: reports/performance.md`
  );
  process.exitCode = failed.length ? 1 : 0;
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
