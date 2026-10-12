# Testing

```bash
npm test                  # unit and integration tests
npm run test:coverage     # with coverage report in coverage/
npm run test:e2e:install  # once: Playwright browsers and their system libraries
npm run test:e2e          # browser tests in Chromium, Firefox, WebKit and a phone
npm run test:perf         # load test of every endpoint, see performance.md
npm run check             # lint, format check, tests and audit, like CI
```

Unit and integration tests need no running database: every test file gets its own SQLite database in
memory. To run the same tests against another database, set `TEST_DATABASE_URL`:

```bash
TEST_DATABASE_URL=mongodb-memory npm test                          # in-memory MongoDB (mongodb-memory-server)
TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/app npm test
```

`mongodb-memory` downloads the MongoDB binary once into `node_modules/.cache`. Any other value is used as
`DATABASE_URL`; the tests create their tables and drop them again at the end, so use an empty database.

## Layout

| Folder                                     | What it tests                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit`                               | Configuration rules, password hashing, TOTP, encryption, i18n, metrics, redirects, sanitizer, error pages, saving the session before a redirect |
| `tests/integration/auth.test.js`           | Sign-up, sign-in, lockout, token rotation and reuse, forged JWTs                                                                                |
| `tests/integration/twoFactor.test.js`      | Two-factor setup, sign-in with code or recovery code, disabling, renewing recovery codes                                                        |
| `tests/integration/passkeys.test.js`       | Passkeys in API and browser with a software authenticator: adding, signing in, replays, other origins, limits, removal                          |
| `tests/integration/email.test.js`          | Email templates, email verification, password reset                                                                                             |
| `tests/integration/users.test.js`          | Admin API, privilege escalation, pagination, sorting                                                                                            |
| `tests/integration/admin.test.js`          | User administration in the browser, user search in the API                                                                                      |
| `tests/integration/account.test.js`        | Data export, profile and password changes, erasure in API and browser                                                                           |
| `tests/integration/sessions.test.js`       | API sessions, signing out single clients or everywhere, activity log                                                                            |
| `tests/integration/web.test.js`            | Pages, navigation, sign-in, form errors, sessions, CSRF                                                                                         |
| `tests/integration/platform.test.js`       | Languages, request ids, `/metrics`                                                                                                              |
| `tests/integration/rateLimitStore.test.js` | Shared rate-limit store, also under parallel requests                                                                                           |
| `tests/integration/security.test.js`       | Headers, CORS, body limits, health, docs, rate limiting                                                                                         |
| `tests/e2e`                                | Browser tests, see below                                                                                                                        |

Coverage thresholds are enforced in `jest.config.js` (85 % statements, lines and functions, 75 % branches).

## Browser tests

`tests/e2e` holds Playwright tests that drive real browsers. `playwright.config.js` starts
`scripts/e2e-server.js`, which runs the app against a throwaway in-memory SQLite database with demo accounts
from `scripts/seed.js`. Nothing is written to disk. The same server is available as `npm run preview` for a
quick look at the interface.

| File                 | What it tests                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pages.spec.js`      | Public, error, account and admin pages in light and dark theme: axe (WCAG 2.2 AA and best practices), no console errors |
| `auth.spec.js`       | Sign-up, sign-in and sign-out, wrong password, two-factor setup and sign-in, busy buttons                               |
| `passkeys.spec.js`   | Adding a passkey and signing in with it, with Chromium's virtual authenticator (Chromium projects only)                 |
| `motion.spec.js`     | Reduced motion, the footer style switch, the scroll story, headline splitting                                           |
| `responsive.spec.js` | No horizontal scrolling from 320 to 3840 px, folding menu, scaling on large screens                                     |

The tests run in four projects: `chromium`, `firefox`, `webkit` and `mobile` (Pixel 7). The mobile project
skips tests tagged `@desktop` and `responsive.spec.js`, because those set their own viewport and would only
repeat the desktop runs. The browser locale is `en-US`, so the tests use the English labels; the German texts
are covered by the i18n tests.

```bash
npx playwright test --project=chromium   # one browser
npx playwright test motion.spec.js       # one file
npx playwright show-report               # HTML report, written when CI is set
```

Outside CI a server already running on the test port (3100, or `E2E_PORT`) is reused.

## Static analysis

`npm run lint` runs ESLint with `eslint-plugin-security` and `eslint-plugin-sonarjs`. The sonarjs preset
contains the JavaScript rules of SonarQube's "Sonar way" profile, so most findings show up in the editor and
in CI before a scanner sees the code. Hard-coded password and IP rules are off for `tests/`, as in SonarQube.

This repository is analysed by [SonarQube Cloud](https://sonarcloud.io/project/overview?id=VectoDE_ExpressJS-Template)
with Automatic Analysis, which reads `.sonarcloud.properties`. Every pull request gets the check "SonarCloud Code
Analysis", and `main` only accepts pull requests that pass its quality gate. Automatic Analysis does not import
test coverage; the coverage thresholds in `jest.config.js` guard it instead.

For your own project, import the repository at sonarcloud.io (free for public repositories) and keep
`.sonarcloud.properties`, or run a scanner in CI with `sonar-project.properties`: sources in `src`, `scripts` and
`docker`, tests in `tests`, coverage from `coverage/lcov.info` (written by `npm run test:coverage`). Set
`sonar.projectKey`, and `sonar.organization` for SonarQube Cloud, before the first scan.

## Pre-commit hook

`npm ci` runs `prepare`, which installs a Git pre-commit hook through `simple-git-hooks`. The hook runs
`lint-staged`: staged JavaScript files go through `eslint --fix` and Prettier, staged JSON, Markdown, YAML and
CSS files through Prettier. After changing the hook configuration in `package.json`, run
`npx simple-git-hooks` again.

## CI

`.github/workflows/ci.yml` runs lint and format check, the Jest tests on Node.js 22 and 24 with coverage, the
browser tests (job "Browser tests", report uploaded on failure), the dependency and license audit and a Docker
build. The job "Database" repeats the Jest tests against MongoDB, PostgreSQL, MySQL, MariaDB, SQL Server and
Oracle in service containers and checks that a resource made with `npm run generate` works on each.

## Writing tests

- `useDatabase()` from `tests/helpers/db.js` connects, empties every table after each test and disconnects.
  Read and change stored data in tests through `db` from the same file, never with database-specific calls.
- `createUser()`, `createAdmin()`, `tokensFor(user)` and `bearer(tokens)` live in `tests/helpers/fixtures.js`.
- `browser(app)` from `tests/helpers/web.js` keeps cookies and fills in the CSRF token of a form.
- `waitForMail()`, `mailTo()` and `tokenFrom()` in `tests/helpers/mail.js` read the email outbox.
- `tests/e2e/helpers.js` has `signIn`, `register`, `signOut`, `expectAccessible` (axe) and
  `horizontalOverflow` for browser tests.
