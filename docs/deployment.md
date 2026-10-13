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
- has one writable folder, `/app/data`, for the default SQLite database; mount a volume there
  (`docker run -v app-data:/app/data …`) or set `DATABASE_URL` to a database server

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

## Database

Set `DATABASE_URL`, see [configuration](configuration.md#database). For any server:

- Use an account with access to this database only. On SQL databases it needs the right to create and alter
  tables, because migrations run on start. To run the app without that right, set `MIGRATION_DATABASE_URL` to a
  second account that may change the schema and run `npm run migrate` before each start of a new version
  (for example as an init container or a release step). The app then only checks that the schema is current.
  The image contains the script: `docker run --rm --env-file .env expressjs-template node scripts/migrate.js`.
- Use TLS for connections across networks (`mongodb+srv://`, `?tls=true`, `?sslmode=require`, `?ssl=true` or
  `?encrypt=true`, depending on the driver).
- Back up regularly and encrypt the backups.

SQLite fits a single instance with a persistent volume. With several instances behind a load balancer, use a
database server, because every instance must see the same sessions and accounts.

To use Compose with another database, delete the `mongo` service and its volume from `docker-compose.yml`,
remove the `depends_on` block of `app` and set `DATABASE_URL` in `.env`.

## Checklist before going live

- [ ] `NODE_ENV=production`; `JWT_SECRET`, `SESSION_SECRET` and `ENCRYPTION_KEY` set from a secret store,
      never committed. Keep `ENCRYPTION_KEY` stable, otherwise two-factor setups stop working
- [ ] `APP_URL` is the public `https://` address
- [ ] `SMTP_URL` points to a mail server with TLS; a test email arrived
- [ ] `TRUST_PROXY` matches the proxy setup; HTTPS only
- [ ] `CORS_ORIGIN` lists exactly the front-end origins, or is empty
- [ ] `API_DOCS_ENABLED` off unless the docs are meant to be public
- [ ] `RATE_LIMIT_STORE=database` and a database server (not SQLite) when running more than one instance
- [ ] Imprint and privacy policy replaced (see [compliance](compliance.md))
- [ ] Monitoring on `/health/ready` and alerts on 5xx rates (`/metrics` with `METRICS_TOKEN` for Prometheus)
- [ ] First admin created with `npm run create-admin` (asks for name, email and password, or reads
      `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`). The Docker image does not contain `scripts/`;
      run it from a checkout that can reach the database, with the production `.env`
- [ ] Two-factor authentication switched on for every admin account

## Releases

Releases are built in GitHub Actions, never on a laptop. `main` only takes pull requests, so a release has two
steps:

1. A pull request sets the new `version` with `npm version 4.1.0 --no-git-tag-version` and moves the
   "Unreleased" entries of [CHANGELOG.md](../CHANGELOG.md) under the new version.
2. After the merge, start the workflow **Tag release** on `main` (Actions tab, or
   `gh workflow run tag.yml --ref main`). It creates the tag `v<version>` with the changelog section as its message,
   signs it with the release key and starts the release workflow for it. The key is a secret of the GitHub
   environment `release`, which only `main` can use; nobody keeps a copy.

`.github/workflows/release.yml` then checks that the tag is signed with the release key, is on `main` and matches
`package.json`, runs
`npm run check` again and publishes:

- the source archive, a CycloneDX SBOM of the runtime dependencies and `SHA256SUMS`, with a signed build
  provenance (`.intoto.jsonl`, Sigstore) attached to the GitHub release
- the Docker image `ghcr.io/vectode/expressjs-template:<version>` (and `latest`) with provenance and SBOM
- release notes grouped by the labels of the merged pull requests (`.github/release.yml`)

Tags with a suffix such as `v4.1.0-rc.1` become pre-releases and do not move `latest`.

Check a download or the image before using it:

```bash
gh attestation verify expressjs-template-4.1.0.tar.gz --repo VectoDE/ExpressJS-Template
gh attestation verify oci://ghcr.io/vectode/expressjs-template:4.1.0 --repo VectoDE/ExpressJS-Template
```
