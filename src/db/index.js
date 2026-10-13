// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const path = require('node:path');
const config = require('../config/config');
const { createMongoAdapter } = require('./mongo');
const { createSqlAdapter } = require('./sql');
const { ClientD1 } = require('./d1');

/**
 * The database is picked by DATABASE_URL:
 *   mongodb://, mongodb+srv://      MongoDB
 *   sqlite:./data/app.db            SQLite file (relative to the project), sqlite::memory: for a throwaway database
 *   postgres://, postgresql://      PostgreSQL (also CockroachDB, YugabyteDB and other wire-compatible servers)
 *   mysql://, mariadb://            MySQL, MariaDB
 *   mssql://, sqlserver://          Microsoft SQL Server, needs `npm install tedious`
 *   oracle://                       Oracle Database, needs `npm install oracledb`
 *   d1:DB                           Cloudflare D1 through the Worker binding DB, only for the demo (DEMO_MODE)
 * Services only talk to the adapter interface, so switching databases needs no code change.
 */
const ROOT = path.join(__dirname, '../..');

const schemeOf = (url) => url.slice(0, url.indexOf(':')).toLowerCase();

const sqliteFile = (url) => {
  const rest = url.slice('sqlite:'.length);
  if (rest === ':memory:' || rest === '') {
    return ':memory:';
  }
  // sqlite:///absolute/path and sqlite:///C:/path on Windows; anything else is relative to the project.
  if (rest.startsWith('//')) {
    const absolute = rest.slice(2);
    return /^\/[A-Za-z]:/.test(absolute) ? absolute.slice(1) : absolute;
  }
  return path.resolve(ROOT, rest);
};

const credentials = (url) => ({
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
});

const knexConfigFor = (scheme, url) => {
  const pool = { min: 0, max: 10 };
  switch (scheme) {
    case 'sqlite':
      return {
        client: 'better-sqlite3',
        connection: { filename: sqliteFile(url) },
        useNullAsDefault: true,
        pool: { min: 1, max: 1 },
      };
    case 'postgres':
    case 'postgresql':
      return { client: 'pg', connection: url, pool };
    case 'mysql':
    case 'mariadb':
      return { client: 'mysql2', connection: url.replace(/^mariadb:/i, 'mysql:'), pool };
    case 'mssql':
    case 'sqlserver': {
      const parsed = new URL(url.replace(/^sqlserver:/i, 'mssql:'));
      const { user, password, database } = credentials(parsed);
      return {
        client: 'mssql',
        connection: {
          server: parsed.hostname,
          port: Number(parsed.port) || 1433,
          user,
          password,
          database,
          options: {
            encrypt: parsed.searchParams.get('encrypt') !== 'false',
            trustServerCertificate: parsed.searchParams.get('trustServerCertificate') === 'true',
          },
        },
        pool,
      };
    }
    case 'oracle': {
      const parsed = new URL(url);
      const { user, password, database } = credentials(parsed);
      return {
        client: 'oracledb',
        connection: { user, password, connectString: `${parsed.hostname}:${parsed.port || 1521}/${database}` },
        pool,
      };
    }
    case 'd1':
      // The binding is registered by the Worker entry (worker/index.mjs); the schema comes from worker/migrations.
      return {
        client: ClientD1,
        connection: { filename: url, binding: url.slice('d1:'.length) || 'DB' },
        useNullAsDefault: true,
      };
    default:
      throw new Error(`DATABASE_URL scheme "${scheme}" is not supported`);
  }
};

const DIALECTS = {
  sqlite: 'sqlite',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mariadb',
  mssql: 'mssql',
  sqlserver: 'mssql',
  oracle: 'oracle',
  d1: 'd1',
};

// `migrate: false` only checks that the schema is current on connect, for apps that run without DDL rights.
const createDatabase = ({ url, name, auditRetentionDays, migrate = true }) => {
  const scheme = schemeOf(url);
  if (scheme === 'mongodb' || scheme === 'mongodb+srv') {
    return createMongoAdapter({ url, dbName: name, auditRetentionDays, migrate });
  }
  // D1 schemas are applied with `wrangler d1 migrations apply`, which keeps its own migration table.
  return createSqlAdapter({
    knexConfig: knexConfigFor(scheme, url),
    dialect: DIALECTS[scheme],
    migrate,
    externalSchema: scheme === 'd1',
  });
};

module.exports = createDatabase({
  url: config.database.url,
  name: config.database.name,
  auditRetentionDays: config.audit.retentionDays,
  migrate: config.database.migrateOnStart,
});
module.exports.createDatabase = createDatabase;
module.exports.sqliteFile = sqliteFile;
module.exports.knexConfigFor = knexConfigFor;
