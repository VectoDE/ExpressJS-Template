# ExpressJS Template

[![CI](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/ci.yml/badge.svg)](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/ci.yml)
[![CodeQL](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/codeql.yml/badge.svg)](https://github.com/VectoDE/ExpressJS-Template/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/VectoDE/ExpressJS-Template/badge)](https://securityscorecards.dev/viewer/?uri=github.com/VectoDE/ExpressJS-Template)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Starter for Express 5 applications with a JSON API and server-rendered pages. Version 4.0.0.

**[Look at the pages](https://vectode.github.io/ExpressJS-Template/)** in a static preview on GitHub Pages, in English
and German. Signing in and forms need the running app; `npm run preview` starts it locally with demo accounts.

It comes with sign-up and sign-in for both an API (JWT) and a browser (session cookie), two-factor
authentication, email verification and password reset, user management for admins, GDPR self-service,
OpenAPI docs, Docker, CI and tests for every endpoint. Security settings are strict
by default; you loosen them where your project needs it, not the other way round.

## What is included

- **API** under `/v1`: register, login with optional second factor, token rotation, logout, email verification,
  password reset, account self-service, sessions and activity log, user admin
- **Browser pages** with EJS in English (default) and German: sign-in, account page with profile, password, two-factor
  and session management, data export, account deletion, user administration, privacy and imprint
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

| Command                           | Purpose                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run setup`                   | Create `.env` with random secrets                                   |
| `npm run dev`                     | Start with reload on changes in `src/`                              |
| `npm start`                       | Start without reload                                                |
| `npm run copy-database`           | Copy accounts and activity to another database (MongoDB ↔ SQL)      |
| `npm run create-admin`            | Create an administrator or promote an existing account              |
| `npm run migrate`                 | Apply database migrations, see `MIGRATION_DATABASE_URL`             |
| `npm run seed`                    | Demo accounts for development (refuses production)                  |
| `npm run generate -- <name>`      | Scaffold an owner-scoped REST resource with tests                   |
| `npm run preview`                 | Start the app with an in-memory database and demo accounts          |
| `npm run build:preview`           | Static copy of the pages for GitHub Pages in `preview-dist/`        |
| `npm test`                        | Unit and integration tests (in-memory SQLite)                       |
| `npm run test:coverage`           | Tests with coverage report                                          |
| `npm run test:e2e`                | Browser tests in Chromium, Firefox, WebKit and a phone (Playwright) |
| `npm run test:e2e:install`        | Install the Playwright browsers once                                |
| `npm run test:perf`               | Load test of every endpoint with latency budgets                    |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                   |
| `npm run licenses`                | Check dependency licenses, regenerate the third-party notices       |
| `npm run check`                   | Lint, format check, tests and audit, as in CI                       |

## Project layout

```text
src/            application code (config, routes, controllers, services, models, views)
tests/          unit, integration, browser (e2e) and performance tests
docs/           documentation
scripts/        setup, admin, seed, generator, preview server, license check
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
