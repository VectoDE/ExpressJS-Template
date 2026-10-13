// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * End-to-end check of the Cloudflare demo against a running Worker:
 *   npm run build:worker && npx wrangler dev --local --local-protocol https
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/worker-smoke.js https://127.0.0.1:8787
 * Walks through register, the verification link shown on the page, sign-in, dashboard, sign-out, password reset,
 * the admin area, the passkey options, the API, Swagger UI and both languages. Prints one line per step and
 * exits with 1 at the first failure. Leaves a throwaway account behind; the hourly reset removes it.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DEMO_ACCOUNTS } = require('../worker/demo-accounts');
const totp = require('../src/utils/totp');

const BASE = (process.argv[2] || 'https://127.0.0.1:8787').replace(/\/$/, '');

// Skipping certificate checks is only acceptable for the self-signed certificate of the local dev server.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' && !['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) {
  console.error('NODE_TLS_REJECT_UNAUTHORIZED=0 is only allowed against 127.0.0.1 or localhost');
  process.exit(1);
}

const decode = (text) =>
  text
    .replaceAll('&amp;', '&')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

const bodyOf = ({ form, json }) => {
  if (form) return new URLSearchParams(form).toString();
  if (json) return JSON.stringify(json);
  return undefined;
};

// A browser in miniature: one cookie jar, manual redirects so every hop is visible.
const browser = () => {
  const jar = new Map();
  const timings = [];
  const request = async (path, { method = 'GET', form, json, headers = {} } = {}) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    const started = performance.now();
    const response = await fetch(new URL(path, BASE), {
      method,
      redirect: 'manual',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: bodyOf({ form, json }),
    });
    const body = await response.text();
    timings.push({ step: `${method} ${path.split('?')[0]}`, ms: Math.round(performance.now() - started) });
    response.headers.getSetCookie().forEach((line) => {
      const [pair, ...attributes] = line.split(';');
      const [name, ...value] = pair.split('=');
      const expired = attributes.some((attribute) => /expires=Thu, 01 Jan 1970/i.test(attribute));
      if (expired) jar.delete(name.trim());
      else jar.set(name.trim(), value.join('='));
    });
    return { status: response.status, location: response.headers.get('location'), body, headers: response.headers };
  };
  const follow = async (path, options) => {
    let result = await request(path, options);
    while (result.status >= 300 && result.status < 400 && result.location) {
      result = await request(result.location);
    }
    return result;
  };
  const csrf = (html) => {
    const match = /name="_csrf" value="([^"]+)"/.exec(html);
    assert.ok(match, 'page has a CSRF token');
    return match[1];
  };
  return { request, follow, csrf, timings, jar };
};

const step = async (name, run) => {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
    throw error;
  }
};

// Path and query of the link in the demo email shown on the page.
const demoLink = (html, pathname) => {
  const url = [...html.matchAll(/href="([^"]+)"/g)]
    .map((match) => new URL(decode(match[1]), BASE))
    .find((candidate) => candidate.pathname === pathname && candidate.searchParams.has('token'));
  assert.ok(url, `page shows the ${pathname} link of the demo email`);
  return `${url.pathname}${url.search}`;
};

const main = async () => {
  const visitor = browser();
  const email = `smoke-${Date.now()}@example.com`;
  // Generated per run; prefix and suffix meet the password rules.
  const password = `Smoke-${crypto.randomBytes(9).toString('base64url')}-1a`;
  const newPassword = `Reset-${crypto.randomBytes(9).toString('base64url')}-2b`;
  let page;

  await step('home page in English and German', async () => {
    page = await visitor.follow('/');
    assert.equal(page.status, 200);
    assert.match(page.body, /<html lang="en"/);
    assert.match(page.body, /Public demo/);
    const german = await visitor.follow('/', { headers: { 'accept-language': 'de' } });
    assert.match(german.body, /<html lang="de"/);
    assert.match(german.body, /Öffentliche Demo/);
  });

  await step('static assets with security headers', async () => {
    const css = await visitor.request('/assets/css/base.css');
    assert.equal(css.status, 200);
    assert.equal(css.headers.get('x-content-type-options'), 'nosniff');
  });

  await step('register shows the verification email', async () => {
    page = await visitor.follow('/register');
    const result = await visitor.request('/register', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), name: 'Smoke Test', email, password },
    });
    assert.equal(result.status, 302, `register answered ${result.status}`);
    page = await visitor.follow(result.location);
    assert.match(page.body, /Email not sent/);
  });

  await step('verification link verifies the address', async () => {
    const link = demoLink(page.body, '/verify-email');
    page = await visitor.follow(link);
    const token = /name="token" value="([^"]+)"/.exec(page.body)[1];
    page = await visitor.follow('/verify-email', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), token: decode(token) },
    });
    assert.equal(page.status, 200);
  });

  await step('dashboard after registration', async () => {
    page = await visitor.follow('/dashboard');
    assert.equal(page.status, 200);
    assert.match(page.body, /Smoke Test/);
  });

  let secret;
  await step('two-factor setup with an authenticator code', async () => {
    page = await visitor.follow('/account/2fa/setup', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), password },
    });
    const shown = /class="totp-secret">.*?<code>([^<]+)<\/code>/s.exec(page.body);
    assert.ok(shown, 'dashboard shows the new secret');
    secret = shown[1].replaceAll(' ', '');
    page = await visitor.follow('/account/2fa/enable', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), code: totp.generate(secret) },
    });
    assert.match(page.body, /recovery-codes/);
  });

  await step('passkey registration options', async () => {
    page = await visitor.follow('/account/passkeys/options', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), password },
    });
    const options = /data-passkey-options="([^"]+)"/.exec(page.body);
    assert.ok(options, 'dashboard offers the passkey form');
    assert.ok(JSON.parse(decode(options[1])).challenge, 'options carry a challenge');
  });

  await step('two-factor off again', async () => {
    page = await visitor.follow('/dashboard');
    // The code of the current step was used to enable; the verifier accepts the next step too.
    const code = totp.generate(secret, Date.now() + 30000);
    page = await visitor.follow('/account/2fa/disable', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), password, code },
    });
    assert.doesNotMatch(page.body, /flash--error/, 'two-factor disabled without error');
  });

  await step('sign out', async () => {
    page = await visitor.follow('/dashboard');
    const result = await visitor.request('/logout', { method: 'POST', form: { _csrf: visitor.csrf(page.body) } });
    assert.equal(result.status, 302);
    const after = await visitor.request('/dashboard');
    assert.equal(after.status, 302, 'dashboard redirects once signed out');
  });

  await step('sign in', async () => {
    page = await visitor.follow('/login');
    const result = await visitor.request('/login', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), email, password },
    });
    assert.equal(result.status, 302);
    page = await visitor.follow(result.location);
    assert.match(page.body, /Smoke Test/);
    await visitor.request('/logout', { method: 'POST', form: { _csrf: visitor.csrf(page.body) } });
  });

  await step('password reset with the link shown on the page', async () => {
    page = await visitor.follow('/forgot-password');
    page = await visitor.follow('/forgot-password', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), email },
    });
    const link = demoLink(page.body, '/reset-password');
    page = await visitor.follow(link);
    const token = /name="token" value="([^"]+)"/.exec(page.body)[1];
    const result = await visitor.request('/reset-password', {
      method: 'POST',
      form: {
        _csrf: visitor.csrf(page.body),
        token: decode(token),
        password: newPassword,
        passwordConfirm: newPassword,
      },
    });
    assert.equal(result.status, 302);
    page = await visitor.follow('/login');
    const login = await visitor.request('/login', {
      method: 'POST',
      form: { _csrf: visitor.csrf(page.body), email, password: newPassword },
    });
    assert.equal(login.status, 302);
    assert.equal(login.location, '/dashboard', 'new password signs in');
  });

  await step('admin area with the demo admin', async () => {
    const admin = browser();
    const account = DEMO_ACCOUNTS.find((entry) => entry.role === 'admin');
    page = await admin.follow('/login');
    const login = await admin.request('/login', {
      method: 'POST',
      form: { _csrf: admin.csrf(page.body), email: account.email, password: account.password },
    });
    assert.equal(login.location, '/dashboard', 'demo admin signs in');
    page = await admin.follow('/admin/users?q=demo.example.com');
    assert.equal(page.status, 200);
    // The list breaks long addresses after the @ with <wbr>.
    assert.match(page.body, /user@<wbr>demo\.example\.com/);
  });

  await step('API: sign in and read the profile', async () => {
    const api = browser();
    const login = await api.request('/v1/auth/login', { method: 'POST', json: { email, password: newPassword } });
    assert.equal(login.status, 200, `API login answered ${login.status}`);
    const { tokens } = JSON.parse(login.body);
    const me = await api.request('/v1/users/profile', { headers: { authorization: `Bearer ${tokens.access.token}` } });
    assert.equal(me.status, 200, `API profile answered ${me.status}`);
    assert.equal(JSON.parse(me.body).user.email, email);
  });

  await step('Swagger UI and OpenAPI document', async () => {
    const docs = await visitor.follow('/docs/');
    assert.equal(docs.status, 200);
    assert.match(docs.body, /swagger-ui-bundle\.js/);
    const bundle = await visitor.request('/docs/swagger-ui-bundle.js');
    assert.equal(bundle.status, 200);
    const init = await visitor.request('/docs/swagger-ui-init.js');
    assert.equal(init.status, 200);
    const spec = await visitor.request('/docs/openapi.json');
    assert.equal(JSON.parse(spec.body).openapi, '3.0.3');
  });

  console.log('\nTimings (wall clock, including local D1):');
  visitor.timings.forEach(({ step: name, ms }) => console.log(`  ${String(ms).padStart(5)} ms  ${name}`));
};

main().catch(() => {
  process.exitCode = 1;
});
