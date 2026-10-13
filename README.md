# ExpressJS Template

[![CI](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/ci.yml/badge.svg)](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/ci.yml)
[![CodeQL](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/codeql.yml/badge.svg)](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/codeql.yml)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15418/badge)](https://www.bestpractices.dev/projects/15418)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/VectoDE/ExpressJS-Template/badge)](https://securityscorecards.dev/viewer/?uri=github.com/VectoDE/ExpressJS-Template)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Starter for Express 5 applications with a JSON API and server-rendered pages. Version 4.0.0.

**[Try the live demo](https://expressjs-template-demo.vectode.workers.dev/)** on Cloudflare Workers, in English and
German, with the [public demo accounts](#live-demo-on-cloudflare). Its data is reset every hour. `npm run preview`
starts the same app locally.

It comes with sign-up and sign-in for both an API (JWT) and a browser (session cookie), two-factor
authentication with an app or a passkey, email verification and password reset, user management for admins, GDPR self-service,
OpenAPI docs, Docker, CI and tests for every endpoint. Security settings are strict
by default; you loosen them where your project needs it, not the other way round.

## What is included

- **API** under `/v1`: register, login with optional second factor (code or passkey), token rotation, logout, email verification,
  password reset, account self-service, sessions and activity log, user admin
- **Browser pages** with EJS in English (default) and German: sign-in, account page with profile, password, two-factor,
  passkey and session management, data export, account deletion, user administration, privacy and imprint
  placeholders. Light and dark theme, WCAG 2.1 AA, no external fonts or scripts
- **Responsive and animated:** layouts for phones, tablets, large monitors and TVs up to 3840 px; five motion
  styles (`MOTION_STYLE`) with a switch in the footer; reduced motion is respected
- **Any database:** SQLite out of the box, MongoDB, PostgreSQL, MySQL, MariaDB, SQL Server or Oracle through
  `DATABASE_URL`. CI runs every test against each of them
- **Modular structure:** layouts and components for views, layered CSS with design tokens, UI texts in
  `src/locales`, routers split by area, a generator for new owner-scoped resources
- **Security:** scrypt hashing, single-use refresh tokens with reuse detection, account lockout, CSRF protection,
  strict CSP and security headers, encrypted session store, validation on every route. Details in
  [docs/security.md](docs/security.md)
- **Quality:** unit and integration tests, Playwright browser tests with accessibility checks, load test of every
  endpoint, ESLint with security and SonarQube rules, Prettier, pre-commit hook
- **Operations:** health and readiness probes, JSON logs, graceful shutdown, non-root Docker image
- **Repository:** CI, CodeQL, OSV scanner, Gitleaks, Dependency Review, OpenSSF Scorecard, Dependabot, release
  workflow

## Quick start

The repository is a GitHub template. Click **Use this template** on GitHub to create your own repository
from it (or run `gh repo create my-app --template VectoDE/ExpressJS-Template --private --clone`), then clone it.

Requirements: Node.js 22.12 or newer. The app stores its data in a SQLite file by default, so no database
server is needed to start. For production, point `DATABASE_URL` at MongoDB, PostgreSQL, MySQL, MariaDB,
SQL Server or Oracle; see [configuration](docs/configuration.md#database).

```bash
cd my-app
npm ci                 # also installs the pre-commit hook
npm run setup          # writes .env with random secrets, never overwrites an existing one
npm run create-admin   # first administrator
npm run dev
```

Open <http://localhost:8080>. API docs are at <http://localhost:8080/docs> outside production. Without
`SMTP_URL`, emails such as verification links are written to the log in development.

`npm run seed` creates demo accounts, including an admin, as an alternative to `create-admin`. To look at the
interface without creating an account, run `npm run preview`: it starts the app on <http://localhost:3100> with
an in-memory database and the demo accounts from `tests/e2e/fixtures.js`.

With Docker:

```bash
cp .env.example .env   # set NODE_ENV=production, the secrets, APP_URL and SMTP_URL
docker compose up -d --build
```

## Scripts

| Command                           | Purpose                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run setup`                   | Create `.env` with random secrets                                            |
| `npm run dev`                     | Start with reload on changes in `src/`                                       |
| `npm start`                       | Start without reload                                                         |
| `npm run copy-database`           | Copy accounts and activity to another database (MongoDB ↔ SQL)               |
| `npm run create-admin`            | Create an administrator or promote an existing account                       |
| `npm run migrate`                 | Apply database migrations, see `MIGRATION_DATABASE_URL`                      |
| `npm run seed`                    | Demo accounts for development (refuses production)                           |
| `npm run generate -- <name>`      | Scaffold an owner-scoped REST resource with tests                            |
| `npm run preview`                 | Start the app with an in-memory database and demo accounts                   |
| `npm run build:preview`           | Static copy of the pages for GitHub Pages in `preview-dist/`                 |
| `npm run build:worker`            | Build the Cloudflare Workers demo, see [Live demo](#live-demo-on-cloudflare) |
| `npm test`                        | Unit and integration tests (in-memory SQLite)                                |
| `npm run test:coverage`           | Tests with coverage report                                                   |
| `npm run test:e2e`                | Browser tests in Chromium, Firefox, WebKit and a phone (Playwright)          |
| `npm run test:e2e:install`        | Install the Playwright browsers once                                         |
| `npm run test:perf`               | Load test of every endpoint with latency budgets                             |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                            |
| `npm run licenses`                | Check dependency licenses, regenerate the third-party notices                |
| `npm run check`                   | Lint, format check, tests and audit, as in CI                                |

## Project layout

```text
src/            application code (config, routes, controllers, services, models, views)
tests/          unit, integration, browser (e2e) and performance tests
docs/           documentation
scripts/        setup, admin, seed, generator, preview server, license check, worker build
worker/         Cloudflare Workers demo: entry point, precompiled views, D1 migrations
.github/        workflows, templates, community files
```

The layers and the request flow are described in [docs/architecture.md](docs/architecture.md).

## Documentation

|                                                                 |                                                 |
| --------------------------------------------------------------- | ----------------------------------------------- |
| [Configuration](docs/configuration.md)                          | Environment variables and production rules      |
| [API](docs/api.md)                                              | Endpoints, authentication, errors               |
| [Security](docs/security.md)                                    | Controls, fixed issues, OWASP mapping           |
| [Compliance](docs/compliance.md)                                | GDPR, cookies, accessibility, imprint, licenses |
| [Testing](docs/testing.md) / [Performance](docs/performance.md) | Test suites and load tests                      |
| [Deployment](docs/deployment.md)                                | Docker, reverse proxy, go-live checklist        |
| [Upgrading](docs/upgrading.md)                                  | Breaking changes in 4.0 and 3.0                 |
| [Changelog](CHANGELOG.md)                                       | Release history                                 |

## Live demo on Cloudflare

The repository can run as a public demo on Cloudflare Workers Free with a D1 database. It is the same Express app;
`worker/` adds a small entry point, precompiled views and stand-ins for packages that cannot run in a Worker. The
demo is for trying the template, not a way to host a real installation: everything it relaxes is switched on by
`DEMO_MODE=true`, which the Worker requires and a normal installation never sets.

What the demo does differently, on purpose:

- **Lower password hashing cost.** scrypt runs with N = 2^10 instead of 2^17 (`PASSWORD_HASH_COST=10`), because
  Workers Free allows 10 ms of CPU per request. Without `DEMO_MODE` a value below 17 is refused at start.
- **Transactions are not atomic.** D1 offers no BEGIN/COMMIT to Knex, so the statements of a transaction run one
  by one and a failure halfway leaves the earlier ones in place. `DATABASE_URL=d1:` is refused without `DEMO_MODE`.
- **Emails are shown, not sent.** The next page shows each message the visitor caused, with its link. This also
  means anyone who knows an account's address can reset its password, and the forgot-password form tells whether
  an address has an account. Emails triggered over the API are not shown anywhere.
- **Data is reset every hour.** A Cron Trigger deletes all records and restores the two demo accounts.
- **Public accounts.** The demo accounts and their passwords are published below; anyone can sign in as admin.

| Account                  | Password              | Role  |
| ------------------------ | --------------------- | ----- |
| `admin@demo.example.com` | `hepfAyQ-rjAEyDc-8Aa` | admin |
| `user@demo.example.com`  | `QmMYbUy-4GtUfHj-1Aa` | user  |

These passwords were generated for the demo and protect nothing else. Do not reuse them.

Deploying needs a Cloudflare account (Workers Free is enough) and these steps, run once:

```bash
npx wrangler login
npx wrangler d1 create expressjs-template-demo
# Put the printed database_id into wrangler.jsonc (d1_databases[0].database_id) and set vars.APP_URL
# to the address the Worker will have, for example https://expressjs-template-demo.<subdomain>.workers.dev
npm run build:worker
npx wrangler d1 migrations apply DB --remote
npx wrangler d1 execute DB --remote --file worker-dist/seed.sql
# Three different random values of at least 32 characters, for example from:
#   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
npx wrangler secret put JWT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler deploy
```

Later updates need `npm run build:worker` and `npx wrangler deploy`, plus `npx wrangler d1 migrations apply DB
--remote` when a migration was added (the build writes it to `worker/migrations`).

To try it locally, create `.dev.vars` (ignored by git) with the three secrets and
`APP_URL=https://localhost:8787`, then run:

```bash
npm run build:worker
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --file worker-dist/seed.sql
npx wrangler dev --local --local-protocol https
NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/worker-smoke.js https://127.0.0.1:8787
```

The last command walks through sign-up, the shown verification link, sign-in, two-factor setup, passkey options,
sign-out, password reset, the admin area, the API and Swagger UI. It turns off certificate checks only for the
self-signed certificate of the local server. `curl "https://127.0.0.1:8787/cdn-cgi/local/scheduled" -k` runs the
hourly reset by hand.

Other limits of the Worker build: compression is left to Cloudflare, `/metrics` reports no event loop delay, and
the views are compiled at build time, so a change to a view needs a new build. Requests that sign in or register
use the most CPU (scrypt plus rendering); they stay below 10 ms in our measurements, but with little margin.

## Before going live

Replace the imprint and privacy pages, set the secrets, `APP_URL` and `SMTP_URL` (TLS only), configure
`TRUST_PROXY` and `CORS_ORIGIN`, and work
through the checklists in [deployment](docs/deployment.md#checklist-before-going-live) and
[compliance](docs/compliance.md#operator-checklist). The legal pages are placeholders, not legal advice.

## Contributing and security

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). Report vulnerabilities privately as described in
[SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE). Licenses of the dependencies are listed in [docs/third-party-notices.md](docs/third-party-notices.md).
