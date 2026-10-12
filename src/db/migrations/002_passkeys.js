// Passkeys (WebAuthn credentials) as a second factor. The credential id can be long (up to 1023 bytes as
// base64url), so it is not indexed; lookups always go through the owner, who has a handful at most.
module.exports = {
  async up(knex) {
    await knex.schema.createTable('passkeys', (table) => {
      table.string('id', 24).primary();
      table.string('user_id', 24).notNullable();
      table.string('credential_id', 1400).notNullable();
      table.string('public_key', 2000).notNullable();
      table.bigInteger('counter').notNullable().defaultTo(0);
      table.string('transports', 255).nullable();
      table.string('name', 60).notNullable();
      table.bigInteger('created_at').notNullable();
      table.bigInteger('last_used_at').nullable();
      table.index(['user_id']);
    });
  },
  async down(knex) {
    await knex.schema.dropTableIfExists('passkeys');
  },
};
