# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [4.1.0] - 2026-10-13

The template now runs as a public live demo on Cloudflare Workers with D1, and releases come with signed version
tags. Nothing changes for existing installations; there is nothing to migrate.

### Added

- Every file states its copyright holder and license in an SPDX header or in `REUSE.toml`; CI checks this with the
  REUSE tool.
- CI builds the release source archive from two separate clones and fails unless both are identical.
- Signed version tags: the workflow "Tag release" creates the tag for the version in `package.json`, signs it with
  the release key from the GitHub environment `release` and starts the release. The release workflow refuses tags
  that are not signed with that key; the public key is in `.github/allowed_signers`.
- The contributing guide has a checklist that every review goes through.
- Live demo on Cloudflare Workers Free with D1 (`npm run build:worker`, `wrangler.jsonc`, `worker/`). The Express
  app runs unchanged; views are precompiled at build time, static files are Workers Static Assets, and a Cron
  Trigger resets the data every hour. See the README section "Live demo on Cloudflare" for deployment and limits.
- `DEMO_MODE` (off by default) for that demo: emails are shown on the next page instead of being sent, and the
  demo-only settings below are allowed. Production checks stay in force otherwise.
- `PASSWORD_HASH_COST` sets the scrypt cost as a power of two. The default stays 17; lower values need
  `DEMO_MODE`. Hashes made with a lower cost are upgraded at the next sign-in.
- `DATABASE_URL=d1:<binding>`: a Knex client for Cloudflare D1, only allowed with `DEMO_MODE` because its
  transactions are not atomic.

### Changed

- The public demo runs at https://expressjs-template-demo.vectode.workers.dev; GitHub Pages now redirects there
  instead of serving the static preview. `npm run build:preview` stays for projects that want a static preview.
- Security policy: a major version keeps getting security fixes for six months after the next one is released.
- Coverage thresholds raised to 90 % for statements, lines and functions and 80 % for branches.
- The metrics endpoint reports an event loop delay of 0 on runtimes without an event loop monitor instead of
  failing at start.
- Contributing guide: coding standards and how dependencies are chosen. Security policy: handling of secrets and
  of vulnerable dependencies. Roadmap for 4.x. OpenSSF Best Practices badge in the README.

### Fixed

- Dependabot's Docker Compose update failed because it looked up the locally built app image on Docker Hub.
  `docker-compose.yml` no longer names that image, so Compose names it and no version needs updating per release.
- Following a link to the API docs no longer logs "Transition was aborted" in Chrome. Swagger UI cannot opt in to
  the page transitions, so the page skips the transition when it leaves for `/docs`.
- Live demo: the sign-in limit counted successful sign-ins too and locked visitors out after ten. The Worker
  cancelled the database update that takes a successful attempt back, because it runs after the response; each
  request now stays alive until its database work is done.

## [4.0.0] - 2026-10-12

Major release: the template now runs on MongoDB and on every common SQL database. See
[upgrading](docs/upgrading.md#upgrading-to-40).

### Changed

- **Breaking:** Mongoose is gone. Services use the data layer in `src/db`, which talks to MongoDB through the
  official driver or to PostgreSQL, MySQL, MariaDB, SQLite, SQL Server and Oracle through Knex. `DATABASE_URL`
  picks the database; `MONGODB_URI` and `MONGODB_DB_NAME` keep working when it is not set.
- **Breaking:** Without any database setting the app now uses the SQLite file `data/app.db` instead of
  `mongodb://127.0.0.1:27017`.
- **Breaking:** Browser sessions moved to the collection or table `web_sessions` with a new encryption format.
  Everybody signed in has to sign in once more after the update.
- SQL databases get their schema from versioned migrations that run on start.
- `npm run generate` writes a migration instead of a Mongoose model; the resource works on every database.
- `RATE_LIMIT_STORE=database` shares rate limits through the configured database. `mongo` still works.
- `npm test` uses an in-memory SQLite database. `TEST_DATABASE_URL` runs the suite against any other database.
- The Docker image has one writable folder, `/app/data`, for SQLite.
- Error pages no longer show a stack trace, also not in development; the log has it.
- Docker Compose and the dev container use MongoDB 9.0; existing 8.x volumes need the upgrade steps in
  [upgrading](docs/upgrading.md#mongodb-9-in-docker-compose) (#19).
- The Docker image, the dev container and `.nvmrc` use Node.js 26. CI tests Node.js 22, 24 and 26 (#18).

### Security

- `npm run create-admin` refuses to promote an account whose email address is not verified, unless `--force`
  is given (#12).
- Redirect targets are rebuilt from a list of known pages instead of being passed through.
- Log lines cannot be split by line breaks in logged values.
- `npm run setup` creates `.env` in one step, so it never overwrites a file created at the same moment.
- The Scorecard workflow runs with read-only permissions at the top level.

### Added

- Passkeys (WebAuthn) as a second factor next to the authenticator app, in the API and on the account page, stored
  in every supported database. Adding one needs two-factor sign-in; at sign-in a passkey replaces the code (#21).
- CI job "Database": the full test suite against MongoDB, PostgreSQL, MySQL, MariaDB, SQL Server and Oracle,
  plus a generated resource on each.
- Contract tests for the data layer that every adapter has to pass.
- Property-based tests with fast-check that feed random input to the redirect check, the sanitizer, LIKE patterns,
  TOTP, encryption, log lines, ids and form fields.
- `MIGRATION_DATABASE_URL` and `npm run migrate`: the running app can use a database account without the right to
  change the schema (#22).
- `npm run copy-database` copies accounts, second factors, activity and valid tokens between any two supported
  databases, keeping ids and password hashes (#20).
- Static preview of every page in English and German on GitHub Pages (`npm run build:preview`).
- Signed releases: source archive, CycloneDX SBOM and Docker image on ghcr.io with build provenance
  (Sigstore), verifiable with `gh attestation verify`.
- DCO sign-off check on pull requests, governance, assurance case and roadmap.

### Fixed

- Checking a one-time code at the very start of the Unix epoch threw instead of answering; found by the new
  property tests.

## [3.0.0] - 2026-10-11

Security release with a full audit. See [upgrading](docs/upgrading.md) for migration steps and
[security](docs/security.md) for every finding.

### Security

- Fixed: anyone could register as admin through `role` in `POST /v1/auth/register`.
- Fixed: users could promote themselves to admin through `PATCH /v1/users/<own id>`.
- Fixed: publicly known default secrets signed tokens and sessions when none were configured.
- Fixed: refresh tokens were accepted as access tokens.
- Fixed: JWTs were stored in the browser session and shown on the dashboard.
- Fixed: tokens and browser sessions from the same second as a password change or "sign out everywhere" stayed valid. Tokens now carry their issue time in milliseconds (`ims`).
- Fixed: open redirect through the `Referer` header after a CSRF failure.
- Fixed: internal error messages reached clients.
- Fixed: 37 known vulnerabilities in dependencies, including `csurf`'s `cookie` dependency.
- Refresh tokens are single use, stored as SHA-256 and revoke all sessions when reused.
- Account lock after failed logins, auth rate limit, constant-time answers for unknown accounts.
- scrypt raised to N=2^17 with automatic upgrade of old hashes.
- Own CSRF protection with per-render masking (BREACH) and Fetch Metadata check.
- Strict CSP, HSTS preload, COOP/COEP/CORP, Permissions-Policy, `Cache-Control: no-store`.
- `__Host-` session cookie, `SameSite=Strict`, absolute session timeout, AES-GCM encrypted session store.
- Tokens and sessions become invalid after password, email or role changes.
- Start-up refuses insecure production configuration.
- Request size limits, header and request timeouts, mongoose `sanitizeFilter`, flat query parsing.
- Error pages never fall back to Express' default page, which would show template errors and file paths.
- Docker Compose: MongoDB with authentication on an internal network; the app uses a `readWrite` user.
- Emails in production only over TLS (`smtps://` on 465 or STARTTLS on 587); plain SMTP is refused.
- Two-factor secrets encrypted at rest with `ENCRYPTION_KEY`; recovery codes stored as hashes.
- A correct password no longer resets the failed-attempt counter while a two-factor code is still missing, so the
  account lockout also stops code guessing.
- Failed browser form submissions count towards the auth rate limit, although they answer with a redirect.
- Endpoints that send email (password reset, verification) count every request per IP, so they cannot flood an inbox.
- `returnTo` targets that only become protocol-relative after dot-segment normalisation (`/..//evil.example`)
  fall back to a local page.
- Production refuses to start without `TRUST_PROXY`, because the secure session cookie needs a trusted TLS proxy.

### Fixed

- Under load the two-factor step could lose its pending sign-in, because the browser followed the redirect
  before the session was stored. The new `saveSessionBeforeRedirect` middleware saves a changed session before
  `res.redirect()` answers.

### Added

- Two-factor sign-in with TOTP and recovery codes, email verification and password reset in API and browser.
- Email service with templates in German and English; without `SMTP_URL` development writes them to the log.
- English UI (default) next to German (`src/locales/de.js`), language switch, `DEFAULT_LOCALE` (default `en`).
- User administration in the browser, API sessions and activity log per account (`AUDIT_RETENTION_DAYS`).
- Request ids, Prometheus endpoint `/metrics` (`METRICS_TOKEN`), shared rate-limit store in MongoDB
  (`RATE_LIMIT_STORE=mongo`).
- Motion system for the web UI: five styles (`MOTION_STYLE`: `film`, `precise`, `playful`, `calm`, `off`), a
  footer switch that keeps the choice in `localStorage` (`MOTION_SWITCH`), headline and entrance animations,
  scroll story on the start page. `prefers-reduced-motion` turns all of it off.
- `motion.css`, `story.css` and `responsive.css`: phones, tablets, landscape phones, large monitors and TVs up
  to 3840 px, touch targets, safe areas for notches, print styles.
- `npm run setup` (writes `.env` with random secrets, never overwrites), `npm run create-admin`,
  `npm run seed` (demo accounts, refuses production) and `npm run generate -- <name>` (owner-scoped CRUD
  resource with model, validation, service, controller, route with OpenAPI docs and integration test).
- Playwright browser tests in Chromium, Firefox, WebKit and on a Pixel 7 with axe accessibility checks and a
  check for horizontal scrolling from 320 to 3840 px (`npm run test:e2e`), CI job "Browser tests",
  `npm run preview` with an in-memory MongoDB.
- `eslint-plugin-sonarjs` with the SonarQube "Sonar way" rules and `sonar-project.properties` for SonarQube
  and SonarQube Cloud.
- Pre-commit hook with `simple-git-hooks` and `lint-staged`.
- Release workflow: a pushed tag `vX.Y.Z` that matches `package.json` creates a GitHub release with notes
  grouped by label.
- GDPR self-service: data export, profile correction and account deletion in API and browser.
- Account page in the browser: change name, email (with current password) and password.
- New browser UI: own logo, light and dark theme, start page that lists the security headers of its own
  response, error pages for every status in both languages, messages that stay until closed.
- Modular views (layouts, components), layered CSS with design tokens, UI texts in `src/locales/de.js`,
  browser routers split into site, auth and account.
- Imprint placeholder, skip link, visible focus, WCAG AA contrast, reduced motion.
- `/health/ready` readiness probe.
- Performance test of every endpoint with latency budgets (`npm run test:perf`).
- Unit and integration tests with an in-memory MongoDB, coverage thresholds.
- ESLint with `eslint-plugin-security`, Prettier, EditorConfig.
- Dockerfile (non-root, pinned digest) and `docker-compose.yml`.
- GitHub workflows: CI, CodeQL, OSV scanner, Dependency Review, Gitleaks, OpenSSF Scorecard, performance.
- Dependabot, issue and pull request templates, CODEOWNERS, security policy, contribution guide,
  release note categories.
- License allow-list check and generated third-party notices (`npm run licenses`), checked in CI.
- Documentation in `docs/`.

### Changed

- Express 5, mongoose 9, helmet 8, express-rate-limit 8, connect-mongo 6, ejs 7, Jest 30, Node.js 22.12+.
- Access tokens 15 minutes, refresh tokens 7 days by default.
- Password rule: 12 to 128 characters with four character classes, Unicode allowed.
- Duplicate emails answer 409 instead of 400.
- Tests moved from `src/tests` to `tests/`, `example.env` renamed to `.env.example`.
- Swagger UI off by default in production; OpenAPI version follows `package.json`.
- Production also requires `ENCRYPTION_KEY`, `APP_URL` (https) and `SMTP_URL`.
- JSON logs in production.

### Removed

- `catchAsync` helper (Express 5 forwards rejected promises itself).
- `csurf`, `xss-clean`, `hpp`, `express-mongo-sanitize`, `cookie-parser`, `dayjs`, `http-status`, `nodemon`.

## [1.0.1] - 2025-10-24

- Secured web experience with sessions and CSRF protection.

## [1.0] - 2024-05-28

- First release.

[Unreleased]: https://github.com/VectoDE/ExpressJS-Template/compare/v4.1.0...HEAD
[4.1.0]: https://github.com/VectoDE/ExpressJS-Template/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/VectoDE/ExpressJS-Template/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/VectoDE/ExpressJS-Template/compare/1.0.1...v3.0.0
[1.0.1]: https://github.com/VectoDE/ExpressJS-Template/compare/v1.0...1.0.1
[1.0]: https://github.com/VectoDE/ExpressJS-Template/releases/tag/v1.0
