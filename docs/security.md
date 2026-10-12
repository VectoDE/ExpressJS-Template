# Security

This page lists what the template protects against and how. To report a vulnerability, follow the
[security policy](../.github/SECURITY.md).

## Fixed in 3.0.0

The 3.0.0 audit found these problems in 2.0.0 / 1.0.1. All are fixed and covered by tests.

| Severity | Problem                                                                                                                            | Fix                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Critical | `POST /v1/auth/register` accepted `role: "admin"`; anyone could create an admin                                                    | Sign-up schema has no `role`; unknown fields are rejected                                 |
| Critical | Any user could `PATCH /v1/users/<own id>` with `role: "admin"` because the auth middleware skipped the rights check for the own id | Rights are always checked; self-service moved to `/v1/account`, which cannot change roles |
| Critical | Publicly known default secrets (`change-me-…`) signed JWTs and sessions when unset                                                 | Secrets are required in production; random per process elsewhere                          |
| High     | Refresh tokens (30 days) were accepted as access tokens                                                                            | Token type, algorithm, issuer and audience are verified                                   |
| High     | Access and refresh tokens were stored in the browser session and printed on the dashboard                                          | The browser UI no longer creates or shows JWTs                                            |
| High     | Refresh tokens stored in plain text, reusable, no theft detection                                                                  | SHA-256 at rest, single use, reuse revokes all sessions                                   |
| High     | No brute-force protection beyond 100 requests per 15 minutes                                                                       | Auth rate limit per IP plus account lock after failed logins                              |
| High     | Query validation never ran under Express 5 (`req.query` is a getter)                                                               | Validation reads the getter; query values are replaced with validated copies              |
| Medium   | `csurf` (deprecated, vulnerable `cookie` dependency)                                                                               | Own synchronizer token with per-render masking and Fetch Metadata check                   |
| Medium   | `xss-clean`, `hpp`, `express-mongo-sanitize` unmaintained or incompatible with Express 5                                           | Removed; schema validation, own sanitizer and typed queries in the data layer             |
| Medium   | Internal error messages (database, driver) were sent to clients                                                                    | Only operational messages leave the server                                                |
| Medium   | CSRF failure redirected to the `Referer` header (open redirect)                                                                    | Fixed redirect targets; `returnTo` only accepts local paths                               |
| Medium   | 10 MB JSON bodies, no password length limit (CPU exhaustion through hashing)                                                       | 100 kB bodies, 128-character passwords                                                    |
| Medium   | Sorting by any field, including the password hash                                                                                  | Allow-list of sort fields                                                                 |
| Medium   | Unique email index not created in production (`autoIndex: false`)                                                                  | Indexes are always built                                                                  |
| Medium   | 37 known vulnerabilities in dependencies (30 high)                                                                                 | All dependencies updated; `npm audit`: 0                                                  |
| Low      | User enumeration through login timing                                                                                              | Unknown accounts run the same scrypt work                                                 |
| Low      | Uptime and version exposed                                                                                                         | Health shows only status; version hidden in production                                    |

## Controls

**Authentication**

- scrypt with N=2^17, r=8, p=1 and a 16-byte salt (OWASP Password Storage Cheat Sheet). Old 1.x hashes are
  verified and upgraded on the next login.
- Account lock after `LOGIN_MAX_ATTEMPTS` failures with an atomic counter. Locked, unknown and wrong-password
  logins get the same answer.
- JWT: HS256 only, `iss`, `aud`, `sub`, `jti`, `exp`, token type. Rights are read from the database.
- Tokens and sessions issued before the last password, email or role change are rejected.
- Optional two-factor sign-in with TOTP (RFC 6238). The secret is stored encrypted with AES-256-GCM under
  `ENCRYPTION_KEY`, recovery codes only as hashes and each usable once, and every code is accepted only once.

**Browser**

- Content Security Policy without `unsafe-inline` or `unsafe-eval`, `frame-ancestors 'none'`, `base-uri 'none'`.
  Only `/docs` allows inline styles because Swagger UI needs them.
- HSTS (2 years, preload), COOP, COEP, CORP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy`, `Cache-Control: no-store` on dynamic responses.
- Session cookie: `HttpOnly`, `Secure` and `__Host-` prefix in production, `SameSite=Strict`, idle and
  absolute timeout, new id at sign-in, destroyed at sign-out, store encrypted with AES-GCM.
- CSRF: session-bound token, masked per render against BREACH, compared in constant time, plus
  `Sec-Fetch-Site` check.

**Input and output**

- Joi schema per route; unknown keys rejected; flat query parsing.
- `$`-keys, dotted keys and prototype keys removed from bodies. The data layer converts every value to the
  expected type before it reaches a query, and SQL queries are parameterised, so request data never becomes an
  operator or SQL text.
- EJS escapes all output; no inline scripts; only local redirects.

**Operations**

- Rate limits per IP (global and for auth), request size limits, header and request timeouts against slowloris.
- Logs without request bodies, CR/LF escaped against log injection, JSON in production.
- Emails in production only over TLS (`requireTLS`); a mail server without TLS is refused.
- Graceful shutdown on SIGTERM/SIGINT and on unexpected errors.
- Docker image runs as non-root, without npm, with a read-only file system in Compose.

**Supply chain**

- Lockfile, `npm audit` and `npm audit signatures` in CI, OSV scanner, CodeQL, Dependency Review,
  Gitleaks, OpenSSF Scorecard, Dependabot for npm, Actions and Docker.
- All GitHub Actions and container images pinned to a commit SHA or digest.
- License allow-list for runtime dependencies (`scripts/check-licenses.js`).

## OWASP Top 10 (2021) mapping

| Risk                                           | Where it is handled                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| A01 Broken Access Control                      | `middlewares/auth.js`, rights from DB, admin self-protection, CSRF, CORS allow-list |
| A02 Cryptographic Failures                     | scrypt, SHA-256 token storage, AES-GCM session store, HSTS, secure cookies          |
| A03 Injection                                  | Joi validation, sanitizer, `sanitizeFilter`, EJS escaping, CSP                      |
| A04 Insecure Design                            | Single-use refresh tokens with reuse detection, absolute session timeout            |
| A05 Security Misconfiguration                  | Start-up refuses insecure settings, docs off in production, strict headers          |
| A06 Vulnerable Components                      | Audits and scanners in CI, Dependabot, pinned actions and images                    |
| A07 Identification and Authentication Failures | Password policy, lockout, rate limits, generic errors                               |
| A08 Software and Data Integrity Failures       | Lockfile, signature audit, SHA-pinned CI, no install scripts in Docker              |
| A09 Security Logging and Monitoring Failures   | Structured logs, warnings for lockouts and token reuse                              |
| A10 SSRF                                       | The app makes no outgoing requests from user input                                  |

## Limits

- Rate limits use in-memory counters by default. With several instances, set `RATE_LIMIT_STORE=database`,
  otherwise each instance counts separately.
- TLS is expected at a reverse proxy. See [deployment](deployment.md).
