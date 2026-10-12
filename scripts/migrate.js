/**
 * Brings the database schema up to date: SQL migrations, or the indexes on MongoDB. Uses MIGRATION_DATABASE_URL when
 * set, so the account of the running app needs no right to change the schema; otherwise DATABASE_URL.
 *
 *   npm run migrate
 *
 * Without MIGRATION_DATABASE_URL the app does the same on every start, so this script is only needed in deployments
 * that separate the two accounts.
 */
const config = require('../src/config/config');
const { createDatabase } = require('../src/db');

const main = async () => {
  const db = createDatabase({
    url: config.database.migrationUrl || config.database.url,
    name: config.database.name,
    auditRetentionDays: config.audit.retentionDays,
    migrate: false,
  });
  try {
    await db.connect().catch((error) => {
      // A schema that is behind is exactly what this script fixes; anything else is a real error.
      if (!/not up to date/.test(error.message)) throw error;
    });
    const applied = await db.migrate();
    process.stdout.write(applied.length ? `Applied: ${applied.join(', ')}\n` : 'The schema is up to date.\n');
  } finally {
    await db.disconnect();
  }
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
