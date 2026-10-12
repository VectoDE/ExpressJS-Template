/**
 * Schema changes for the SQL databases, applied in this order and recorded in knex_migrations; Knex runs pending
 * ones on start. Add a change as a new file and a new entry at the end (the generator does both for new
 * resources). Never edit or reorder a migration that has already run somewhere.
 */
const MIGRATIONS = [
  ['001_initial', require('./001_initial')],
  ['002_passkeys', require('./002_passkeys')],
  // New migrations go here.
].map(([name, migration]) => ({ name, ...migration }));

// Knex migration source: migrations are plain modules, so they work from any working directory.
module.exports = {
  getMigrations: async () => MIGRATIONS,
  getMigrationName: (migration) => migration.name,
  getMigration: async (migration) => migration,
};
