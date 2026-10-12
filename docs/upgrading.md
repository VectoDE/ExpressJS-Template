# Upgrading

## Upgrading to 4.0

4.0 replaces Mongoose with a data layer for MongoDB and SQL databases. Data stored by 3.0 in MongoDB keeps
working: collection and field names did not change.

| Area              | 3.0                                   | 4.0                                                    | What to do                                                                 |
| ----------------- | ------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Database setting  | `MONGODB_URI`, `MONGODB_DB_NAME`      | `DATABASE_URL`, `DATABASE_NAME`                        | Nothing; the old names still work. Rename when convenient                  |
| No setting at all | `mongodb://127.0.0.1:27017`           | SQLite file `data/app.db`                              | Set `DATABASE_URL` if you relied on the local MongoDB default              |
| Browser sessions  | collection `sessions` (connect-mongo) | collection or table `web_sessions`                     | Users sign in once more. Drop the old `sessions` collection afterwards     |
| Rate-limit store  | `RATE_LIMIT_STORE=mongo`              | `RATE_LIMIT_STORE=database`                            | Nothing; `mongo` is an alias                                               |
| Own models        | `src/models/*.model.js` (Mongoose)    | `db.owned('<table>')` or own methods in `src/db`       | Port own models; see a resource made with `npm run generate` as an example |
| Own queries       | `Model.find(...)`                     | Methods of `require('src/db')`, or `db.knex` on SQL    | Replace direct Mongoose calls                                              |
| Tests             | in-memory MongoDB                     | in-memory SQLite, `TEST_DATABASE_URL` for others       | Use `db` from `tests/helpers/db.js` instead of models                      |
| Error pages       | Stack trace in development            | Never a stack trace                                    | Read it in the log                                                         |
| `create-admin`    | Promoted every account                | Promotes verified accounts, others only with `--force` | Verify the address first or pass `--force`                                 |

To move from MongoDB to a SQL database, start the new version once against the empty SQL database so the
migrations create the tables, then copy users, tokens and audit events with a script of your own. Sessions
and rate-limit counters do not need to be copied.

## Upgrading to 3.0

3.0.0 is a major release. It replaces 1.0.1, whose `package.json` already said 2.0.0. To avoid two different
codebases with the same number, the next version is 3.0.0.

### Requirements

- Node.js 22.12 or newer (24 recommended)
- MongoDB 6.0 or newer (driver 7)

### Breaking changes

| Area            | Before                              | Now                                                                                      | What to do                                                             |
| --------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Express         | 4                                   | 5                                                                                        | Check own routes for Express 5 path syntax and `req.query` assignments |
| Secrets         | Defaults `change-me-…`              | Required in production                                                                   | Set `JWT_SECRET` and `SESSION_SECRET`                                  |
| Encryption key  | None                                | `ENCRYPTION_KEY` required in production                                                  | Set a third random secret, different from the other two; keep it       |
| App URL         | None                                | `APP_URL` required in production, `https://` only                                        | Set the public address; it is used for links in emails                 |
| Email           | No email                            | `SMTP_URL` required in production, TLS required                                          | Use `smtps://…:465` or STARTTLS on 587; plain SMTP relays are refused  |
| Proxy           | Optional                            | `TRUST_PROXY` of at least 1 required in production                                       | Run behind a TLS proxy and set the number of proxies                   |
| CORS            | `*` by default                      | No cross-origin access by default                                                        | Set `CORS_ORIGIN`                                                      |
| Sign-up         | Accepted `role`                     | Rejects `role` (400)                                                                     | Create admins through `POST /v1/users`                                 |
| Self-service    | `PATCH /v1/users/:ownId`            | `PATCH /v1/account`                                                                      | Update clients                                                         |
| Token lifetime  | 30 min / 30 days                    | 15 min / 7 days                                                                          | Override with `JWT_*_EXPIRATION_*` if needed                           |
| Tokens          | Old JWTs without `iss`/`aud`        | Rejected                                                                                 | Users sign in again once                                               |
| Refresh tokens  | Stored in plain text                | Stored as hash                                                                           | Old refresh tokens stop working; users sign in again                   |
| Passwords       | 8 characters, letters and digits    | 12 to 128 characters, four classes                                                       | Existing passwords keep working; the rule applies to new ones          |
| Password hashes | scrypt N=2^14, `salt:key`           | scrypt N=2^17, `scrypt$…`                                                                | Upgraded automatically at the next login                               |
| Session cookie  | `sid`                               | `__Host-sid` in production, `SameSite=Strict`                                            | Users sign in again once                                               |
| Dashboard       | Showed API tokens                   | Does not                                                                                 | Get tokens through `POST /v1/auth/login`                               |
| Swagger         | Always on                           | Off in production                                                                        | `API_DOCS_ENABLED=true`                                                |
| Env file        | `example.env`                       | `.env.example`                                                                           | Rename your template                                                   |
| Tests           | `src/tests`                         | `tests/`                                                                                 | Move own tests                                                         |
| Errors          | `400 Email already taken`           | `409`                                                                                    | Update clients                                                         |
| Views           | `partials/` and per-page HTML frame | `layouts/` and `components/`, one error page                                             | Move own pages to `layouts/top` / `layouts/bottom`                     |
| Styles          | `public/css/main.css`               | `tokens.css`, `base.css`, `layout.css`, `components.css`, `motion.css`, `responsive.css` | Port custom rules; colours and timing live in `tokens.css`             |
| Scripts         | `public/js/main.js`                 | `motion-init.js` in `<head>` plus `main.js`                                              | Keep both in custom layouts; set `MOTION_STYLE=off` for no animation   |
| Helpers         | `utils/catchAsync`                  | Removed                                                                                  | Use plain `async` handlers (Express 5)                                 |

### Email in production

Production refuses to start without `SMTP_URL`, and the connection to the mail server must be encrypted. If
your mail relay only speaks plain SMTP (often port 25 inside a private network), the app starts, but every
email fails and only the log shows it. Switch the relay to TLS, or send through a provider that offers
`smtps://` on port 465 or STARTTLS on port 587. Details in [configuration](configuration.md#email) and
[deployment](deployment.md#email).

### New tools

- `npm run setup` writes `.env` with fresh secrets and never overwrites an existing file.
- `npm run create-admin` creates the first administrator or promotes an existing account.
- `npm run seed` fills a development database with demo accounts and refuses to run in production.
- `npm run generate -- <name>` scaffolds an owner-scoped REST resource with tests.
- `npm run preview` and `npm run test:e2e` start the app against an in-memory MongoDB.

### Removed dependencies

`csurf`, `xss-clean`, `hpp`, `express-mongo-sanitize`, `cookie-parser`, `dayjs`, `http-status` and `nodemon`.
`npm run dev` now uses `node --watch`.
