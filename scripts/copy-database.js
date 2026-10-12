/**
 * Copies accounts, their second factors, recovery codes and passkeys, valid tokens and the activity log from one database to
 * another, for example from MongoDB to PostgreSQL. Ids, timestamps and password hashes stay as they are, so users
 * sign in with their passwords and second factors as before. Browser sessions and rate-limit counters are not
 * copied: everybody signs in once more. Records of resources made with `npm run generate` need their own step.
 *
 *   SOURCE_DATABASE_URL=mongodb://... TARGET_DATABASE_URL=postgres://... npm run copy-database
 *
 * The target must be empty; its tables or indexes are created first. URLs are read from the environment, not from
 * the command line, so passwords do not end up in the shell history. For MongoDB, SOURCE_DATABASE_NAME and
 * TARGET_DATABASE_NAME pick the database (default: DATABASE_NAME).
 */
const { createDatabase } = require('../src/db');
const { newId } = require('../src/utils/id');

const PAGE = 500;
const ALL = 2_000_000_000;

const copyUsers = async (source, target, offset = 0, copied = 0) => {
  const { results } = await source.users.list({}, { sortBy: 'createdAt', descending: false, offset, limit: PAGE });
  await results.reduce(async (previous, user) => {
    await previous;
    await target.users.restore(user);
    const passkeys = await source.passkeys.listForUser(user.id);
    await Promise.all(passkeys.map((passkey) => target.passkeys.create(passkey)));
    // Activity entries carry no id outside the database that stored them; the target gives them new ones.
    const events = await source.audit.list(user.id, ALL);
    await Promise.all(events.map((event) => target.audit.restore({ ...event, id: newId(), userId: user.id })));
  }, Promise.resolve());
  const total = copied + results.length;
  return results.length === PAGE ? copyUsers(source, target, offset + PAGE, total) : total;
};

/**
 * Copies everything from `source` to `target` (both adapters, connected). Returns the counts per kind.
 */
const copyDatabase = async (source, target) => {
  if ((await target.users.count()) > 0) {
    throw new Error('The target database already has accounts. Copy only into an empty database.');
  }
  const users = await copyUsers(source, target);
  const now = new Date();
  const tokens = (await source.tokens.list({})).filter((token) => token.expires > now);
  await Promise.all(tokens.map((token) => target.tokens.create(token)));
  return { users, tokens: tokens.length };
};

const main = async () => {
  const { SOURCE_DATABASE_URL, TARGET_DATABASE_URL } = process.env;
  if (!SOURCE_DATABASE_URL || !TARGET_DATABASE_URL) {
    throw new Error('Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL.');
  }
  const config = require('../src/config/config');
  const open = (url, name) =>
    createDatabase({ url, name: name || config.database.name, auditRetentionDays: config.audit.retentionDays });
  const source = open(SOURCE_DATABASE_URL, process.env.SOURCE_DATABASE_NAME);
  const target = open(TARGET_DATABASE_URL, process.env.TARGET_DATABASE_NAME);
  try {
    // The source is only read; connecting it brings an older schema up to date, as the app would on start.
    await source.connect();
    await target.connect();
    const { users, tokens } = await copyDatabase(source, target);
    process.stdout.write(`Copied ${users} accounts with their activity log and ${tokens} valid tokens.\n`);
  } finally {
    await Promise.allSettled([source.disconnect(), target.disconnect()]);
  }
};

if (require.main?.filename === __filename) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { copyDatabase };
