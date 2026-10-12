# Security assurance case

Why the template meets its security requirements: what it protects, against whom, where the trust boundaries
are, and how secure design principles and the common weaknesses are handled. The individual controls are listed
in [security](security.md).

## Security requirements

1. Only the owner of an account can act as that account, in the API and in the browser.
2. Only administrators can read or change other accounts or give out roles.
3. Passwords, tokens, second-factor secrets and session contents cannot be read from a copy of the database.
4. Signed-in sessions and tokens end when the password, email or role changes, or when the user signs out
   everywhere.
5. Request data never changes the meaning of a database query, on MongoDB or on a SQL database.
6. A production start with an insecure configuration fails instead of running.
7. Releases and images can be traced back to a reviewed commit on `main`.

## Threat model

| Actor                                   | Goal                                                         | Requirement |
| --------------------------------------- | ------------------------------------------------------------ | ----------- |
| Visitor without an account              | Sign in as someone else, guess passwords or codes            | 1, 4        |
| Signed-in user                          | Become admin, read or change other accounts or their records | 2, 5        |
| Attacker with a stolen token or cookie  | Keep access after the victim reacts                          | 4           |
| Attacker with a database dump or backup | Recover passwords, second factors or active sessions         | 3           |
| Malicious website in the same browser   | Submit forms in the user's name (CSRF), read responses       | 1           |
| Operator mistake                        | Run production with default secrets or without TLS           | 6           |
| Attacker in the supply chain            | Ship modified code or images to users of the template        | 7           |

Out of scope: a compromised server or administrator, and applications that changed the template afterwards.

## Trust boundaries

- **HTTP requests** are untrusted. Every route validates body, query and parameters with a Joi schema that
  rejects unknown fields; a sanitizer removes `$`-keys, dotted keys and prototype keys before that.
- **The data layer** (`src/db`) is the only code that talks to the database. It converts every value to the
  expected type, builds MongoDB filters from those values and passes SQL values as bound parameters.
- **Environment variables** come from the operator. They are validated at start; production refuses missing or
  placeholder secrets, plain HTTP and wildcard CORS.
- **The database** is trusted to store what it is given, not to keep secrets: hashes, encrypted second factors
  and encrypted sessions are all it sees.
- **Email** leaves the system only over TLS in production.

## Secure design principles

- **Economy of mechanism:** one data layer with a small interface; each security rule lives in one place
  (password hashing, token checks, CSRF, rate limiting) and is used everywhere.
- **Fail-safe defaults:** unknown fields are rejected, CORS is closed, API docs are off in production, errors
  answer with a generic message, a missing record and a foreign record give the same 404.
- **Complete mediation:** rights are read from the database on every request, never from the token alone.
- **Least privilege:** the container runs as an unprivileged user on a read-only file system; the Compose
  database user may only use its own database; CI jobs have read-only tokens unless a step needs more.
- **Separation of privilege:** admin actions need the admin role and, for promotion through `create-admin`,
  a verified email address.
- **Open design:** code, tests, threat model and release process are public.

## Common weaknesses countered

| Weakness                                | Countermeasure                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CWE-89 / CWE-943 injection into queries | Typed values only; bound parameters on SQL; MongoDB filters built without user-supplied operators        |
| CWE-79 cross-site scripting             | EJS escapes output; strict CSP with nonces, no inline scripts                                            |
| CWE-352 CSRF                            | Synchronizer token per session, masked per render, plus a Fetch Metadata check                           |
| CWE-307 brute force                     | Rate limit per IP, account lock after repeated failures, one-time codes accepted once                    |
| CWE-916 weak password hashing           | scrypt N=2^17 with automatic upgrade of older hashes                                                     |
| CWE-613 insufficient session expiration | Idle and absolute timeouts; credential changes end older sessions and tokens                             |
| CWE-639 IDOR                            | Owner filter in every query of generated resources; admin routes check the role                          |
| CWE-601 open redirect                   | Redirect targets rebuilt from a list of known pages                                                      |
| CWE-117 log injection                   | Line breaks in logged values are replaced                                                                |
| CWE-1357 / CWE-494 supply chain         | Lockfile, `npm audit`, OSV-Scanner, Dependabot, pinned actions and images, signed provenance on releases |

## Evidence

- Tests: `npm run check` (lint, format, more than 350 unit and integration tests, audit), browser tests with
  accessibility checks, the full suite against MongoDB, PostgreSQL, MySQL, MariaDB, SQL Server and Oracle in CI,
  and attack-specific tests such as `tests/integration/security.test.js`.
- Static analysis: CodeQL and SonarQube Cloud on every pull request, ESLint with security and Sonar rules at
  `--max-warnings 0`, Gitleaks for secrets.
- Supply chain: [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/VectoDE/ExpressJS-Template),
  signed provenance on every release.
