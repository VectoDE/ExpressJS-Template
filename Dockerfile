# syntax=docker/dockerfile:1.10
# Base image pinned by digest (node 26.10.0 on Alpine 3.24) in both stages, so Dependabot can propose updates.
FROM node:26.10.0-alpine3.24@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# No install scripts, no dev dependencies, exact versions from the lockfile.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:26.10.0-alpine3.24@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80 AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
# Remove npm and corepack from the final image: the app never needs them at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    && apk upgrade --no-cache
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --chown=root:root package.json ./
COPY --chown=root:root src ./src
# For deployments with a separate migration account: docker run ... node scripts/migrate.js
COPY --chown=root:root scripts/migrate.js ./scripts/migrate.js
# The only folder the process may write to: the default SQLite database lives here. Mount a volume on it.
RUN mkdir data && chown node:node data
VOLUME ["/app/data"]
# Runs as the unprivileged "node" user; the code is owned by root and therefore read-only for the process.
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "src/server.js"]
