# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [3.0.0] - 2026-10-11

Security release with a full audit. See [upgrading](upgrading.md) for migration steps and
[security](security.md) for every finding.

### Security

- Fixed: anyone could register as admin through `role` in `POST /v1/auth/register`.
- Fixed: users could promote themselves to admin through `PATCH /v1/users/<own id>`.
- Fixed: publicly known default secrets signed tokens and sessions when none were configured.
- Fixed: refresh tokens were accepted as access tokens.
- Fixed: JWTs were stored in the browser session and shown on the dashboard.
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
- English UI next to German (`src/locales/en.js`), language switch, `DEFAULT_LOCALE`.
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
  response, German error pages for every status, messages that stay until closed.
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

[Unreleased]: https://github.com/VectoDE/ExpressJS-Template/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/VectoDE/ExpressJS-Template/compare/1.0.1...v3.0.0
[1.0.1]: https://github.com/VectoDE/ExpressJS-Template/compare/v1.0...1.0.1
[1.0]: https://github.com/VectoDE/ExpressJS-Template/releases/tag/v1.0
