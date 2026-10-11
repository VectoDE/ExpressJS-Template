/**
 * Creates .env from .env.example and fills JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY and METRICS_TOKEN with
 * random values. An existing .env is never touched, so running it twice is safe.
 *
 *   npm run setup
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SECRETS = ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY', 'METRICS_TOKEN'];

const randomSecret = () => crypto.randomBytes(48).toString('base64url');

// Fills only empty secret lines; everything else in the example stays as written.
const fillSecrets = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => {
      const [key] = line.split('=', 1);
      return SECRETS.includes(key) && line === `${key}=` ? `${key}=${randomSecret()}` : line;
    })
    .join('\n');

const main = () => {
  const target = path.join(ROOT, '.env');
  if (fs.existsSync(target)) {
    process.stdout.write('.env already exists, nothing changed.\n');
    return;
  }
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  // wx fails instead of overwriting if the file appeared in the meantime.
  fs.writeFileSync(target, fillSecrets(example), { flag: 'wx', mode: 0o600 });
  process.stdout.write(`.env created with new values for ${SECRETS.join(', ')}.\n`);
  process.stdout.write('Next: start MongoDB, then "npm run create-admin" and "npm run dev".\n');
};

if (require.main?.filename === __filename) {
  main();
}

module.exports = { fillSecrets };
