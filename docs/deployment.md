# Deployment

## Docker

```bash
cp .env.example .env
# set NODE_ENV=production, JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY, APP_URL, SMTP_URL,
# CORS_ORIGIN, TRUST_PROXY=1, MONGO_ROOT_PASSWORD and MONGO_APP_PASSWORD
docker compose up -d --build
```

The image:

- is based on `node:24-alpine`, pinned by digest and updated by Dependabot
- installs only production dependencies with `npm ci --ignore-scripts`
- removes npm and corepack from the final stage
- runs as the unprivileged `node` user; the code belongs to root and is read-only for the process
- has a `HEALTHCHECK` against `/health`

`docker-compose.yml` adds a read-only root file system, drops all Linux capabilities, sets
`no-new-privileges` and publishes the app only on `127.0.0.1:8080`. MongoDB:

- sits on an internal network without a route to the outside and without published ports
- requires authentication; Compose refuses to start while `MONGO_ROOT_PASSWORD` or `MONGO_APP_PASSWORD` is empty
- gets an application user from `docker/mongo/init-app-user.js` that may only read and write its own
  database. The app connects with this user and never sees the root password.

The init script runs only when the volume is created. To change the app password later, change it in
MongoDB and in `.env`.

## Reverse proxy and TLS

Run the app behind a proxy that terminates TLS (nginx, Caddy, Traefik, a cloud load balancer) and set
`TRUST_PROXY` to the number of proxies. Production refuses to start without it: secure cookies would never be set
and rate limits would see the proxy IP.

Minimal nginx example:

```nginx
server {
  listen 443 ssl;
  http2 on;
  server_name app.example.com;
  ssl_protocols TLSv1.2 TLSv1.3;
  client_max_body_size 128k;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Email

Production requires `SMTP_URL`, and the connection to the mail server must use TLS:

- `smtps://user:password@smtp.example.com:465` for TLS from the start, or
- `smtp://user:password@smtp.example.com:587` for a server that offers STARTTLS.

A relay without TLS (for example plain SMTP on port 25 inside a private network) is refused, and the email is
not sent. The app still starts; the failure appears in the log as `Email "..." could not be sent`. Send a
password reset to yourself after deploying and check that it arrives. See [configuration](configuration.md#email).

## MongoDB

- Enable authentication and use a user with access to this database only.
- Use TLS for connections across networks (`mongodb+srv://` or `?tls=true`).
- Back up regularly and encrypt the backups.

## Checklist before going live

- [ ] `NODE_ENV=production`; `JWT_SECRET`, `SESSION_SECRET` and `ENCRYPTION_KEY` set from a secret store,
      never committed. Keep `ENCRYPTION_KEY` stable, otherwise two-factor setups stop working
- [ ] `APP_URL` is the public `https://` address
- [ ] `SMTP_URL` points to a mail server with TLS; a test email arrived
- [ ] `TRUST_PROXY` matches the proxy setup; HTTPS only
- [ ] `CORS_ORIGIN` lists exactly the front-end origins, or is empty
- [ ] `API_DOCS_ENABLED` off unless the docs are meant to be public
- [ ] `RATE_LIMIT_STORE=mongo` when running more than one instance
- [ ] Imprint and privacy policy replaced (see [compliance](compliance.md))
- [ ] Monitoring on `/health/ready` and alerts on 5xx rates (`/metrics` with `METRICS_TOKEN` for Prometheus)
- [ ] First admin created with `npm run create-admin` (asks for name, email and password, or reads
      `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`). The Docker image does not contain `scripts/`;
      run it from a checkout that can reach the database, with the production `.env`
- [ ] Two-factor authentication switched on for every admin account

## Releases

`.github/workflows/release.yml` runs when a tag `vX.Y.Z` is pushed. It checks that the tag matches the
`version` in `package.json` and creates a GitHub release with generated notes. The notes are grouped by the
labels of the merged pull requests as configured in `.github/release.yml` (security, breaking change,
features, fixes, dependencies, documentation). Tags with a suffix such as `v3.1.0-rc.1` become pre-releases.

```bash
npm version 3.1.0 -m "Release %s"   # updates package.json and package-lock.json, commits and tags v3.1.0
git push --follow-tags
```

Add the release to [changelog.md](changelog.md) before tagging.
