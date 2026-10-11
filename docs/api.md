# API

Base path: `/v1`. The OpenAPI 3 document is served at `/docs/openapi.json` and Swagger UI at `/docs/`
when `API_DOCS_ENABLED` is on (default outside production). Without it both paths answer 404.

## Authentication

1. `POST /v1/auth/login` (or `/register`) returns an access token (15 minutes) and a refresh token (7 days).
2. With two-factor sign-in on, `/login` returns `twoFactorRequired`, a short-lived `challengeToken` and
   `expiresIn` (seconds) instead. Send `challengeToken` and a code from the app or a recovery code to
   `POST /v1/auth/login/2fa` to get the tokens.
3. Send the access token as `Authorization: Bearer <token>`.
4. When it expires, call `POST /v1/auth/refresh-tokens`. You get a new pair; the old refresh token is spent.
5. Presenting a spent refresh token again ends every API session of that user. Treat it as theft.
6. `POST /v1/auth/logout` revokes a refresh token.

With `AUTH_REQUIRE_VERIFIED_EMAIL` on, `/register` answers 201 with `user` and `verificationRequired: true`
but no tokens, and `/login` answers 403 for an unverified account and sends a new verification email.

Changing password, email or role, resetting the password and "sign out everywhere" invalidate all existing
tokens and browser sessions of that user.

## Rate limits

- General limit: every request except `/health`, `/health/ready`, `/metrics` and static files under `/assets` counts towards
  `RATE_LIMIT_MAX` per IP and `RATE_LIMIT_WINDOW_MINUTES`.
- Auth limit: routes marked "auth" in the tables below also count towards the much lower `AUTH_RATE_LIMIT_MAX`.
  Only failed requests count: status 400 and above, and browser forms that redirect back with an error message.
- Email limit: routes marked "email" send mail and answer the same whether or not a mail went out. Every request
  counts towards `AUTH_RATE_LIMIT_MAX` in a separate counter.

## Endpoints

Access values: "public" needs nothing, "bearer token" needs a valid access token, "admin" needs a bearer token
of a user with the `manageUsers` right (role `admin`).

| Method | Path                               | Access                         | Rate limit | Purpose                                                       |
| ------ | ---------------------------------- | ------------------------------ | ---------- | ------------------------------------------------------------- |
| GET    | `/health`                          | public                         | none       | Liveness                                                      |
| GET    | `/health/ready`                    | public                         | none       | Readiness, 503 without database                               |
| GET    | `/metrics`                         | `Bearer <METRICS_TOKEN>`       | none       | Prometheus metrics, 404 when `METRICS_TOKEN` is not set       |
| GET    | `/docs/`, `/docs/openapi.json`     | public                         | general    | Swagger UI and OpenAPI document, only with `API_DOCS_ENABLED` |
| POST   | `/v1/auth/register`                | public                         | auth       | Create a regular user                                         |
| POST   | `/v1/auth/login`                   | public                         | auth       | Sign in, or get a 2FA challenge                               |
| POST   | `/v1/auth/login/2fa`               | challenge token                | auth       | Finish a 2FA sign-in with `challengeToken` and `code`         |
| POST   | `/v1/auth/refresh-tokens`          | refresh token                  | auth       | Rotate tokens                                                 |
| POST   | `/v1/auth/logout`                  | refresh token                  | general    | Revoke a refresh token                                        |
| POST   | `/v1/auth/send-verification-email` | bearer token                   | email      | Send a new verification link, 400 if already verified         |
| POST   | `/v1/auth/verify-email`            | public, `token` from the email | auth       | Verify the email address                                      |
| POST   | `/v1/auth/forgot-password`         | public                         | email      | Request a reset link, always 204                              |
| POST   | `/v1/auth/reset-password`          | public, `token` from the email | auth       | Set a new password, ends all sessions and lifts a lockout     |
| GET    | `/v1/users/profile`                | bearer token                   | general    | Own profile                                                   |
| GET    | `/v1/account/export`               | bearer token                   | general    | Download all personal data (GDPR Art. 15, 20)                 |
| PATCH  | `/v1/account`                      | bearer token                   | auth       | Change name, email, password or locale (Art. 16)              |
| DELETE | `/v1/account`                      | bearer token + password        | auth       | Delete own account, its tokens and activity log (Art. 17)     |
| GET    | `/v1/account/sessions`             | bearer token                   | general    | List signed-in API clients, one per refresh-token family      |
| DELETE | `/v1/account/sessions`             | bearer token                   | auth       | Sign out everywhere, API and browser                          |
| DELETE | `/v1/account/sessions/:sessionId`  | bearer token                   | general    | Sign out one API client                                       |
| GET    | `/v1/account/activity`             | bearer token                   | general    | Last 50 security events, newest first                         |
| GET    | `/v1/account/2fa`                  | bearer token                   | general    | Two-factor status                                             |
| POST   | `/v1/account/2fa/setup`            | bearer token + password        | auth       | Start setup: returns `secret`, `otpauthUrl` and `qrSvg`       |
| POST   | `/v1/account/2fa/enable`           | bearer token + code            | auth       | Confirm setup, returns ten recovery codes once                |
| POST   | `/v1/account/2fa/disable`          | bearer token + password + code | auth       | Turn two-factor sign-in off                                   |
| POST   | `/v1/account/2fa/recovery-codes`   | bearer token + code            | auth       | Replace all recovery codes                                    |
| GET    | `/v1/users`                        | admin                          | general    | List users, `limit` ≤ 100, `sortBy` from an allow-list        |
| POST   | `/v1/users`                        | admin                          | general    | Create a user with a role                                     |
| GET    | `/v1/users/:userId`                | admin                          | general    | Read a user                                                   |
| PATCH  | `/v1/users/:userId`                | admin                          | general    | Update a user                                                 |
| DELETE | `/v1/users/:userId`                | admin                          | general    | Delete a user                                                 |

Changing email or password through `PATCH /v1/account` requires `currentPassword` in the same body.
Wrong 2FA codes on `/v1/auth/login/2fa` count towards the account lockout. When a recovery code was used,
the response carries the number left in `X-Recovery-Codes-Remaining`.

Admins cannot change their own role or delete their own account through `/v1/users`, so the last admin
cannot lock everyone out by accident.

## Browser routes

Server-rendered pages with session cookie and CSRF token. They use the same services as the API.
Access values: "guests" means not signed in, "signed in" needs a session, "admin" needs a session of a user
with the `manageUsers` right.

| Method | Path                                  | Access              | Rate limit | Purpose                                                  |
| ------ | ------------------------------------- | ------------------- | ---------- | -------------------------------------------------------- |
| GET    | `/`                                   | public              | general    | Start page with the security headers of the response     |
| GET    | `/security`, `/privacy`, `/imprint`   | public              | general    | Information pages                                        |
| GET    | `/language/:locale`                   | public              | general    | Switch the language, then redirect to `returnTo` or `/`  |
| GET    | `/login`, `/register`                 | guests              | general    | Forms                                                    |
| POST   | `/login`, `/register`                 | guests              | auth       | Sign in or sign up, new session id                       |
| GET    | `/login/2fa`                          | guests, pending 2FA | general    | Form for the second factor after the password step       |
| POST   | `/login/2fa`                          | guests, pending 2FA | auth       | Finish the sign-in with a code or recovery code          |
| POST   | `/logout`                             | signed in           | general    | End the session                                          |
| GET    | `/forgot-password`                    | guests              | general    | Form                                                     |
| POST   | `/forgot-password`                    | guests              | email      | Request a reset link                                     |
| GET    | `/reset-password?token=…`             | public              | general    | New password form, only for a valid token                |
| POST   | `/reset-password`                     | public              | auth       | Set the new password (typed twice)                       |
| GET    | `/verify-email?token=…`               | public              | general    | Confirmation page, only for a valid token                |
| POST   | `/verify-email`                       | public              | auth       | Verify the email address                                 |
| GET    | `/dashboard`                          | signed in           | general    | Account page with 2FA, sessions and recent activity      |
| GET    | `/account/export`                     | signed in           | general    | Data export as JSON (Art. 15, 20)                        |
| POST   | `/account/profile`                    | signed in           | auth       | Change name; email only with current password (Art. 16)  |
| POST   | `/account/password`                   | signed in           | auth       | Change password, ends all other sessions and API tokens  |
| POST   | `/account/verification`               | signed in           | email      | Send a new verification link                             |
| POST   | `/account/2fa/setup`                  | signed in           | auth       | Start the 2FA setup with password confirmation           |
| POST   | `/account/2fa/enable`                 | signed in           | auth       | Confirm the setup with a code, shows recovery codes once |
| POST   | `/account/2fa/disable`                | signed in           | auth       | Turn 2FA off with password and code                      |
| POST   | `/account/2fa/recovery-codes`         | signed in           | auth       | Replace all recovery codes                               |
| POST   | `/account/sessions/revoke-all`        | signed in           | auth       | Sign out everywhere, then start a fresh session          |
| POST   | `/account/sessions/:sessionId/revoke` | signed in           | general    | Sign out one API client                                  |
| POST   | `/account/delete`                     | signed in           | auth       | Delete the account with password confirmation (Art. 17)  |
| GET    | `/admin/users`                        | admin               | general    | User list with search (`q`), `role` filter and `page`    |
| GET    | `/admin/users/:userId`                | admin               | general    | User details with 2FA status and recent activity         |
| POST   | `/admin/users/:userId`                | admin               | general    | Change name and role                                     |
| POST   | `/admin/users/:userId/delete`         | admin               | general    | Delete a user                                            |

As in the API, admins cannot change their own role or delete themselves in the browser.

## Input rules

- API bodies must be JSON up to 100 kB. Browser forms are URL-encoded up to 20 kB. Unknown fields in API
  bodies are rejected with 400.
- Passwords: 12 to 128 characters with lower case, upper case, a digit and a symbol. Unicode is allowed.
- Emails are trimmed and lower-cased.
- Query strings are parsed flat (`a[b]=c` is not an object).

## Errors

Every error has the same shape:

```json
{ "code": 401, "message": "Invalid or expired token" }
```

Server errors always answer `Internal Server Error` without details. The cause is logged on the server.
Rate-limited requests get `429` and the `RateLimit` / `RateLimit-Policy` headers (IETF draft 8).
