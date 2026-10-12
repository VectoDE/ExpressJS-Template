// First schema of the SQL databases: accounts, recovery codes, tokens, activity log, browser sessions, rate limits.
// Column types are the portable subset: strings with a length (indexable everywhere, also on SQL Server and
// Oracle), BIGINT milliseconds for times, booleans and integers.
module.exports = {
  async up(knex) {
    await knex.schema.createTable('users', (table) => {
      table.string('id', 24).primary();
      table.string('name', 120).notNullable();
      table.string('email', 254).notNullable().unique();
      table.string('password', 255).notNullable();
      table.string('role', 20).notNullable();
      table.boolean('is_email_verified').notNullable().defaultTo(false);
      table.string('locale', 5).notNullable();
      table.bigInteger('credentials_changed_at').notNullable();
      table.integer('failed_login_attempts').notNullable().defaultTo(0);
      table.bigInteger('lock_until').nullable();
      table.boolean('two_factor_enabled').notNullable().defaultTo(false);
      table.string('two_factor_secret', 255).nullable();
      table.string('two_factor_pending_secret', 255).nullable();
      table.bigInteger('two_factor_last_used_step').notNullable().defaultTo(-1);
      table.bigInteger('two_factor_enabled_at').nullable();
      table.bigInteger('created_at').notNullable();
      table.bigInteger('updated_at').notNullable();
      table.index(['role']);
      table.index(['created_at']);
    });
    await knex.schema.createTable('recovery_codes', (table) => {
      table.string('user_id', 24).notNullable();
      table.string('code_hash', 64).notNullable();
      table.primary(['user_id', 'code_hash']);
    });
    await knex.schema.createTable('tokens', (table) => {
      table.string('id', 24).primary();
      table.string('token_hash', 64).notNullable().unique();
      table.string('user_id', 24).notNullable();
      table.string('type', 20).notNullable();
      table.bigInteger('expires').notNullable();
      table.string('family', 64).nullable();
      table.string('device', 120).nullable();
      table.bigInteger('started_at').nullable();
      table.string('email', 254).nullable();
      table.bigInteger('created_at').notNullable();
      table.index(['user_id', 'type']);
      table.index(['expires']);
    });
    await knex.schema.createTable('audit_events', (table) => {
      table.string('id', 24).primary();
      table.string('user_id', 24).notNullable();
      table.string('type', 40).notNullable();
      table.string('device', 120).nullable();
      table.bigInteger('created_at').notNullable();
      table.index(['user_id', 'created_at']);
      table.index(['created_at']);
    });
    await knex.schema.createTable('web_sessions', (table) => {
      table.string('id', 128).primary();
      table.text('data').notNullable();
      table.bigInteger('expires_at').notNullable();
      table.index(['expires_at']);
    });
    await knex.schema.createTable('rate_limits', (table) => {
      table.string('id', 255).primary();
      table.integer('hits').notNullable();
      table.bigInteger('expires_at').notNullable();
      table.index(['expires_at']);
    });
  },
  async down(knex) {
    const tables = ['rate_limits', 'web_sessions', 'audit_events', 'tokens', 'recovery_codes', 'users'];
    await tables.reduce(
      (previous, table) => previous.then(() => knex.schema.dropTableIfExists(table)),
      Promise.resolve()
    );
  },
};
