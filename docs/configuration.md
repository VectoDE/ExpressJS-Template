# Configuration

All settings come from environment variables. `src/config/config.js` validates them with Joi at start-up.
The app does not start with an invalid or insecure configuration.

For local work, `npm run setup` copies `.env.example` to `.env` and fills `JWT_SECRET`, `SESSION_SECRET`,
`ENCRYPTION_KEY` and `METRICS_TOKEN` with random values. It never overwrites an existing `.env`. Copying the
file by hand works as well.

Generate secrets by hand with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| Variable                         | Default                                        | Notes                                                                       |
| -------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`                       | `development`                                  | `production`, `development` or `test`                                       |
| `PORT`                           | `8080`                                         |                                                                             |
| `APP_NAME`                       | `Express.js Template`                          | Shown in the header, page titles and emails                                 |
| `APP_URL`                        | `http://localhost:<PORT>`                      | Public address for links in emails. Required in production, must be `https` |
| `DEFAULT_LOCALE`                 | `en`                                           | `en` or `de`, used when the browser asks for neither                        |
| `MONGODB_URI`                    | `mongodb://127.0.0.1:27017/expressjs_template` | `mongodb://` or `mongodb+srv://`                                            |
| `MONGODB_DB_NAME`                | `expressjs_template`                           | Letters, digits, `_` and `-`                                                |
| `JWT_SECRET`                     | random per process outside production          | Required in production, 32 to 512 characters                                |
| `JWT_ISSUER`                     | `expressjs-template`                           | Checked on every token                                                      |
| `JWT_AUDIENCE`                   | `expressjs-template-api`                       | Checked on every token                                                      |
| `JWT_ACCESS_EXPIRATION_MINUTES`  | `15`                                           | 1 to 60                                                                     |
| `JWT_REFRESH_EXPIRATION_DAYS`    | `7`                                            | 1 to 30                                                                     |
| `SESSION_SECRET`                 | random per process outside production          | Required in production, 32 to 512 characters                                |
| `ENCRYPTION_KEY`                 | random per process outside production          | Encrypts two-factor secrets. Changing it makes existing 2FA setups unusable |
| `SESSION_NAME`                   | `sid`                                          | Gets the `__Host-` prefix when cookies are secure                           |
| `SESSION_IDLE_TIMEOUT_MINUTES`   | `30`                                           | Inactivity timeout                                                          |
| `SESSION_ABSOLUTE_TIMEOUT_HOURS` | `12`                                           | Maximum session age, independent of activity                                |
| `SESSION_COOKIE_SECURE`          | `true` in production                           | Cannot be disabled in production                                            |
| `TRUST_PROXY`                    | `0`                                            | Number of reverse proxies in front of the app. At least 1 in production     |
| `CORS_ORIGIN`                    | empty                                          | Comma-separated origins for `/v1`. Empty means no cross-origin access       |
| `API_DOCS_ENABLED`               | `false` in production                          | Swagger UI and `/docs/openapi.json`                                         |
| `RATE_LIMIT_WINDOW_MINUTES`      | `15`                                           | Window for both limiters                                                    |
| `RATE_LIMIT_MAX`                 | `300`                                          | Requests per IP and window, all routes except assets, health and metrics    |
| `AUTH_RATE_LIMIT_MAX`            | `10`                                           | Failed sign-in, sign-up, refresh and account requests per IP and window     |
| `RATE_LIMIT_STORE`               | `memory`                                       | `memory` counts per process, `mongo` shares the counters between instances  |
| `LOGIN_MAX_ATTEMPTS`             | `5`                                            | Failed logins before the account is locked                                  |
| `LOGIN_LOCK_MINUTES`             | `15`                                           | Lock duration                                                               |
| `SMTP_URL`                       | empty                                          | `smtps://` or `smtp://` URL. Required in production, see [Email](#email)    |
| `MAIL_FROM`                      | `Express.js Template <no-reply@localhost>`     | Sender of all emails                                                        |
| `AUTH_REQUIRE_VERIFIED_EMAIL`    | `false`                                        | `true` allows sign-in only after the email address is confirmed             |
| `AUDIT_RETENTION_DAYS`           | `180`                                          | How long the activity log keeps events, 1 to 3650                           |
| `METRICS_TOKEN`                  | empty                                          | Bearer token for `GET /metrics`. Empty switches the endpoint off (404)      |
| `MOTION_STYLE`                   | `film`                                         | Animation style of the web pages, see [Motion](#motion)                     |
| `MOTION_SWITCH`                  | `true`                                         | Shows the style switch in the footer                                        |
| `LOG_LEVEL`                      | `info`                                         | Winston level. JSON lines in production                                     |

## Production rules

In production the app refuses to start when:

- `JWT_SECRET`, `SESSION_SECRET` or `ENCRYPTION_KEY` is missing or looks like a placeholder, or two of them are equal
- `METRICS_TOKEN` is set but looks like a placeholder
- `APP_URL` is missing or does not use `https://`
- `SMTP_URL` is missing
- `CORS_ORIGIN` contains `*`
- `SESSION_COOKIE_SECURE=false`
- `TRUST_PROXY` is `0` or `false`: without a trusted TLS proxy the secure session cookie is never set
- a `CORS_ORIGIN` entry is not a plain origin such as `https://app.example.com`

Outside production a missing secret is replaced by a random value for the lifetime of the process, and the
server logs a warning. Sessions, tokens and two-factor setups then become invalid on every restart, which is
intended.

## Email

`src/services/email.service.js` sends verification, password reset and security notices with nodemailer.

- Without `SMTP_URL` (allowed outside production only) nothing is sent. In development the text of each
  email, including its link, is written to the log.
- In production the connection must be encrypted (nodemailer's `requireTLS`). Use
  `smtps://user:password@smtp.example.com:465` for TLS from the first byte, or
  `smtp://user:password@smtp.example.com:587` for a server that offers STARTTLS. A server without TLS is
  refused and the email is not sent.
- Outside production a local test server without TLS still works.

Emails are sent in the background and failures are only logged, so a mail server that refuses the connection
does not show up as an error in the browser. Send a test email (for example a password reset) after changing
`SMTP_URL` and check the logs.

## Motion

The web pages animate entrances, headlines, page changes and the scroll story on the start page.
`MOTION_STYLE` sets the default:

| Value     | Effect                         |
| --------- | ------------------------------ |
| `film`    | Soft, long movements (default) |
| `precise` | Short and direct, no overshoot |
| `playful` | Springy, with longer paths     |
| `calm`    | Fades only, no movement        |
| `off`     | No animation                   |

With `MOTION_SWITCH=true` the footer shows a switch with the same five styles. The choice is stored in the
browser (`localStorage`, key `motion-style`) and never reaches the server. `MOTION_SWITCH=false` removes the
switch, and a choice stored earlier is ignored.

Visitors who ask for reduced motion in their system settings get no animation, whatever the style. Without
JavaScript every element is shown in its final state.

## Docker Compose only

These variables are read by `docker-compose.yml`, not by the app.

| Variable              | Default  | Purpose                                                                |
| --------------------- | -------- | ---------------------------------------------------------------------- |
| `MONGO_ROOT_USERNAME` | `root`   | MongoDB administrator, only used to create the app user                |
| `MONGO_ROOT_PASSWORD` | required | Password of the administrator                                          |
| `MONGO_APP_USERNAME`  | `app`    | User the app connects with (`readWrite` on its database only)          |
| `MONGO_APP_PASSWORD`  | required | Letters and digits only, because it becomes part of the connection URL |
