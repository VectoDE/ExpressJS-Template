// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Entry point of the public demo on Cloudflare Workers (see the README, "Live demo on Cloudflare").
 * The unchanged Express app runs through the Node.js HTTP compatibility layer; views come precompiled, the
 * database is D1, static files are served as Workers Static Assets, and a Cron Trigger resets the data.
 * Build first: `npm run build:worker`.
 */
import './runtime-fixes.js';
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import ejs from 'ejs';
import { registerD1Binding } from '../src/db/d1.js';
import config from '../src/config/config.js';
import logger from '../src/config/logger.js';
import app from '../src/app.js';
import db from '../src/db/index.js';
import { resetDemoData } from './demo.js';
import demoSeed from '../worker-dist/demo-seed.js';

const PORT = 8080;

// The Worker is the demo and nothing else; without DEMO_MODE it refuses to start instead of running half relaxed.
if (!config.demo) {
  throw new Error('The Cloudflare Worker build only runs the public demo; set DEMO_MODE=true');
}

/**
 * Some database work starts only after the response has gone out: express-rate-limit takes back the hit of a
 * successful sign-in once the response has finished. A Worker cancels whatever is still running when its response
 * is done, so every D1 statement is tracked here and each request stays alive until none is left (see `fetch`).
 * Without this the sign-in limit counted successful attempts too and locked visitors out after ten sign-ins.
 */
const pending = new Set();
const track = (promise) => {
  pending.add(promise);
  promise.then(
    () => pending.delete(promise),
    () => pending.delete(promise)
  );
  return promise;
};
const trackedStatement = (statement) => ({
  bind: (...values) => trackedStatement(statement.bind(...values)),
  all: () => track(statement.all()),
});
const settle = async () => {
  do {
    // One turn of the event loop lets the work queued behind the response (response 'finish' handlers) start.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    await Promise.allSettled([...pending]);
  } while (pending.size > 0);
};

registerD1Binding('DB', { prepare: (sql) => trackedStatement(env.DB.prepare(sql)) });

// `ejs` is the precompiled-view stand-in (worker/stubs/ejs.js); Express cannot look up view files on disk here.
app.engine('ejs', ejs.viewEngine.engine);
app.set('view', ejs.viewEngine.PrecompiledView);

app.listen(PORT);
const server = httpServerHandler({ port: PORT });

/**
 * Cloudflare sets CF-Connecting-IP to the real client address. The app trusts exactly one proxy (TRUST_PROXY=1),
 * so the forwarding headers are rewritten here from what Cloudflare reports; whatever a client sent in them is
 * dropped. Rate limits and the HTTPS check of the session cookie then see the right values.
 */
const forwarded = (request) => {
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '127.0.0.1');
  headers.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''));
  headers.delete('x-forwarded-host');
  headers.delete('forwarded');
  return new Request(request, { headers });
};

export default {
  async fetch(request, workerEnv, ctx) {
    const response = await server.fetch(forwarded(request), workerEnv, ctx);
    ctx.waitUntil(settle());
    return response;
  },

  // Cron Trigger (wrangler.jsonc): every hour all demo data is deleted and the demo accounts come back.
  async scheduled(controller, workerEnv, ctx) {
    ctx.waitUntil(
      resetDemoData(db, demoSeed).then(
        () => logger.info('Demo data reset'),
        (error) => logger.error('Demo data reset failed: %s', error.message)
      )
    );
  },
};
