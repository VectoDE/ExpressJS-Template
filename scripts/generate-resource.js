/**
 * Scaffolds a REST resource that belongs to the signed-in user: SQL migration, validation, service, controller, route
 * with OpenAPI docs and an integration test. It works with every supported database: the service stores records
 * through db.owned(), MongoDB needs no migration. Every query is scoped to the owner, so one user can never read or
 * change another user's records (no IDOR by default). Existing files are never overwritten.
 *
 *   npm run generate -- note        creates /v1/notes
 *   npm run generate -- invoice-item creates /v1/invoice-items
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const words = (input) =>
  String(input)
    .trim()
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

const names = (input) => {
  const parts = words(input);
  if (parts.length === 0 || parts.some((part) => !/^[a-z][a-z0-9]*$/.test(part))) {
    throw new Error('Use letters and digits only, for example "note" or "invoice-item".');
  }
  const camel = parts.map((part, index) => (index ? part[0].toUpperCase() + part.slice(1) : part)).join('');
  const pascal = camel[0].toUpperCase() + camel.slice(1);
  const kebab = parts.join('-');
  const plural = (word) => {
    if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
    return `${word}s`;
  };
  const pluralParts = [...parts.slice(0, -1), plural(parts.at(-1))];
  return {
    camel,
    pascal,
    kebab,
    path: plural(kebab),
    table: pluralParts.join('_'),
    label: parts.join(' '),
  };
};

const files = (n) => ({
  [`src/db/migrations/${n.migration}.js`]: `// Table for ${n.label} records. MongoDB needs no migration; the collection is created on first use.
module.exports = {
  async up(knex) {
    await knex.schema.createTable('${n.table}', (table) => {
      table.string('id', 24).primary();
      // Every record belongs to one user; all queries filter on it.
      table.string('owner_id', 24).notNullable();
      table.string('title', 200).notNullable();
      table.text('body').nullable();
      table.bigInteger('created_at').notNullable();
      table.bigInteger('updated_at').notNullable();
      table.index(['owner_id', 'created_at']);
    });
  },
  async down(knex) {
    await knex.schema.dropTableIfExists('${n.table}');
  },
};
`,
  [`src/validations/${n.camel}.validation.js`]: `const Joi = require('joi');
const { objectId } = require('./custom.validation');

const params = Joi.object().keys({ ${n.camel}Id: Joi.string().required().custom(objectId) });

const fields = {
  title: Joi.string().trim().min(1).max(200),
  body: Joi.string().trim().max(10000).allow(''),
};

const create${n.pascal} = {
  body: Joi.object().keys({ title: fields.title.required(), body: fields.body }),
};

const list${n.pascal}s = {
  query: Joi.object().keys({
    sortBy: Joi.string().pattern(/^(title|createdAt|updatedAt):(asc|desc)$/),
    limit: Joi.number().integer().min(1).max(100).default(10),
    page: Joi.number().integer().min(1).max(10000).default(1),
  }),
};

const get${n.pascal} = { params };

const update${n.pascal} = {
  params,
  body: Joi.object().keys({ title: fields.title, body: fields.body }).min(1),
};

const delete${n.pascal} = { params };

module.exports = { create${n.pascal}, list${n.pascal}s, get${n.pascal}, update${n.pascal}, delete${n.pascal} };
`,
  [`src/services/${n.camel}.service.js`]: `const db = require('../db');
const { newId } = require('../utils/id');
const ApiError = require('../utils/ApiError');
const httpStatus = require('../utils/httpStatus');

const records = db.owned('${n.table}');

const toPublic = (record) => ({
  id: record.id,
  title: record.title,
  body: record.body ?? '',
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

// Not found and "belongs to someone else" look the same, so IDs of other users' records leak nothing.
const notFound = () => new ApiError(httpStatus.NOT_FOUND, '${n.pascal} not found');

const create = async (ownerId, body) =>
  toPublic(await records.create(ownerId, { id: newId(), title: body.title, body: body.body ?? '' }));

const list = async (ownerId, options = {}) => {
  const [field, order] = (options.sortBy || 'createdAt:desc').split(':');
  const limit = options.limit || 10;
  const page = options.page || 1;
  const { results, total } = await records.list(ownerId, {
    sortBy: field,
    descending: order === 'desc',
    offset: (page - 1) * limit,
    limit,
  });
  return {
    results: results.map((record) => toPublic(record)),
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    totalResults: total,
  };
};

const get = async (ownerId, id) => {
  const record = await records.find(ownerId, id);
  if (!record) {
    throw notFound();
  }
  return toPublic(record);
};

const update = async (ownerId, id, body) => {
  const record = await records.update(ownerId, id, body);
  if (!record) {
    throw notFound();
  }
  return toPublic(record);
};

const remove = async (ownerId, id) => {
  if (!(await records.remove(ownerId, id))) {
    throw notFound();
  }
};

// Called when an account is deleted, so no orphaned records stay behind (GDPR Art. 17).
const removeAllOf = (ownerId) => records.removeAllOf(ownerId);

module.exports = { create, list, get, update, remove, removeAllOf };
`,
  [`src/controllers/${n.camel}.controller.js`]: `const httpStatus = require('../utils/httpStatus');
const pick = require('../utils/pick');
const ${n.camel}Service = require('../services/${n.camel}.service');

const create${n.pascal} = async (req, res) => {
  res.status(httpStatus.CREATED).json({ ${n.camel}: await ${n.camel}Service.create(req.user.id, req.body) });
};

const list${n.pascal}s = async (req, res) => {
  res.status(httpStatus.OK).json(await ${n.camel}Service.list(req.user.id, pick(req.query, ['sortBy', 'limit', 'page'])));
};

const get${n.pascal} = async (req, res) => {
  res.status(httpStatus.OK).json({ ${n.camel}: await ${n.camel}Service.get(req.user.id, req.params.${n.camel}Id) });
};

const update${n.pascal} = async (req, res) => {
  const ${n.camel} = await ${n.camel}Service.update(req.user.id, req.params.${n.camel}Id, req.body);
  res.status(httpStatus.OK).json({ ${n.camel} });
};

const delete${n.pascal} = async (req, res) => {
  await ${n.camel}Service.remove(req.user.id, req.params.${n.camel}Id);
  res.status(httpStatus.NO_CONTENT).send();
};

module.exports = { create${n.pascal}, list${n.pascal}s, get${n.pascal}, update${n.pascal}, delete${n.pascal} };
`,
  [`src/routes/v1/${n.camel}.route.js`]: `const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const ${n.camel}Validation = require('../../validations/${n.camel}.validation');
const ${n.camel}Controller = require('../../controllers/${n.camel}.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: ${n.pascal}s
 *   description: ${n.label} records of the signed-in user
 */

/**
 * @swagger
 * /${n.path}:
 *   post:
 *     summary: Create a ${n.label}
 *     tags: [${n.pascal}s]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               body: { type: string, maxLength: 10000 }
 *     responses:
 *       "201": { description: Created }
 *       "400": { $ref: '#/components/responses/BadRequest' }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 *   get:
 *     summary: List own ${n.label} records
 *     tags: [${n.pascal}s]
 *     parameters:
 *       - { in: query, name: sortBy, schema: { type: string, example: "createdAt:desc" } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *     responses:
 *       "200": { description: One page of results }
 *       "401": { $ref: '#/components/responses/Unauthorized' }
 * /${n.path}/{id}:
 *   parameters:
 *     - { in: path, name: id, required: true, schema: { type: string } }
 *   get:
 *     summary: Get one ${n.label}
 *     tags: [${n.pascal}s]
 *     responses:
 *       "200": { description: The record }
 *       "404": { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     summary: Change a ${n.label}
 *     tags: [${n.pascal}s]
 *     responses:
 *       "200": { description: The changed record }
 *       "404": { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Delete a ${n.label}
 *     tags: [${n.pascal}s]
 *     responses:
 *       "204": { description: Deleted }
 *       "404": { $ref: '#/components/responses/NotFound' }
 */
router
  .route('/')
  .post(auth(), validate(${n.camel}Validation.create${n.pascal}), ${n.camel}Controller.create${n.pascal})
  .get(auth(), validate(${n.camel}Validation.list${n.pascal}s), ${n.camel}Controller.list${n.pascal}s);

router
  .route('/:${n.camel}Id')
  .get(auth(), validate(${n.camel}Validation.get${n.pascal}), ${n.camel}Controller.get${n.pascal})
  .patch(auth(), validate(${n.camel}Validation.update${n.pascal}), ${n.camel}Controller.update${n.pascal})
  .delete(auth(), validate(${n.camel}Validation.delete${n.pascal}), ${n.camel}Controller.delete${n.pascal});

module.exports = router;
`,
  [`tests/integration/${n.camel}.test.js`]: `const request = require('supertest');
const app = require('../../src/app');
const { useDatabase } = require('../helpers/db');
const { createUser, tokensFor, bearer } = require('../helpers/fixtures');

useDatabase();

const signedIn = async () => {
  const user = await createUser();
  return { user, headers: bearer(await tokensFor(user)) };
};

describe('/v1/${n.path}', () => {
  it('creates, lists, changes and deletes own records', async () => {
    const { headers } = await signedIn();
    const created = await request(app).post('/v1/${n.path}').set(headers).send({ title: 'First' }).expect(201);
    const id = created.body.${n.camel}.id;

    const list = await request(app).get('/v1/${n.path}').set(headers).expect(200);
    expect(list.body.totalResults).toBe(1);

    const changed = await request(app).patch(\`/v1/${n.path}/\${id}\`).set(headers).send({ title: 'Renamed' }).expect(200);
    expect(changed.body.${n.camel}.title).toBe('Renamed');

    await request(app).delete(\`/v1/${n.path}/\${id}\`).set(headers).expect(204);
    await request(app).get(\`/v1/${n.path}/\${id}\`).set(headers).expect(404);
  });

  it("never shows another user's records", async () => {
    const owner = await signedIn();
    const other = await signedIn();
    const created = await request(app).post('/v1/${n.path}').set(owner.headers).send({ title: 'Private' }).expect(201);
    const id = created.body.${n.camel}.id;

    await request(app).get(\`/v1/${n.path}/\${id}\`).set(other.headers).expect(404);
    await request(app).patch(\`/v1/${n.path}/\${id}\`).set(other.headers).send({ title: 'x' }).expect(404);
    await request(app).delete(\`/v1/${n.path}/\${id}\`).set(other.headers).expect(404);
    expect((await request(app).get('/v1/${n.path}').set(other.headers).expect(200)).body.totalResults).toBe(0);
  });

  it('rejects unknown fields and requests without a token', async () => {
    const { headers } = await signedIn();
    await request(app).post('/v1/${n.path}').set(headers).send({ title: 'x', owner: 'someone' }).expect(400);
    await request(app).get('/v1/${n.path}').expect(401);
  });
});
`,
});

// Adds the migration to the list in src/db/migrations/index.js, after the existing ones.
const registerMigration = (n) => {
  const file = path.join(ROOT, 'src/db/migrations/index.js');
  const source = fs.readFileSync(file, 'utf8');
  const entry = `  ['${n.migration}', require('./${n.migration}')],`;
  if (source.includes(entry)) return false;
  fs.writeFileSync(file, source.replace('  // New migrations go here.', `${entry}\n  // New migrations go here.`));
  return true;
};

// Mounts the new router next to the existing ones in src/routes/v1/index.js.
const register = (n) => {
  const file = path.join(ROOT, 'src/routes/v1/index.js');
  let source = fs.readFileSync(file, 'utf8');
  const requireLine = `const ${n.camel}Route = require('./${n.camel}.route');`;
  if (source.includes(requireLine)) return false;
  source = source.replace('const router = express.Router();', `${requireLine}\n\nconst router = express.Router();`);
  source = source.replace(
    '\nmodule.exports = router;',
    `router.use('/${n.path}', ${n.camel}Route);\n\nmodule.exports = router;`
  );
  fs.writeFileSync(file, source);
  return true;
};

// Formats the new files with the project's Prettier settings when Prettier is installed (it is a dev dependency).
const format = async (file) => {
  let prettier;
  try {
    prettier = require('prettier');
  } catch {
    return;
  }
  const options = (await prettier.resolveConfig(file)) || {};
  const source = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, await prettier.format(source, { ...options, filepath: file }));
};

const main = async () => {
  const input = process.argv[2];
  if (!input) {
    throw new Error('Usage: npm run generate -- <name>   (for example: npm run generate -- note)');
  }
  // Migrations run in file name order; the timestamp puts a new one after every existing one.
  const stamp = new Date().toISOString().replaceAll(/\D/g, '').slice(0, 14);
  const n = { ...names(input), migration: `${stamp}_create_${names(input).table}` };
  const planned = files(n);
  const existing = Object.keys(planned).filter((file) => fs.existsSync(path.join(ROOT, file)));
  if (existing.length) {
    throw new Error(`Nothing written, these files exist already:\n  ${existing.join('\n  ')}`);
  }
  for (const [file, content] of Object.entries(planned)) {
    fs.writeFileSync(path.join(ROOT, file), content, { flag: 'wx' });
  }
  await Promise.all(Object.keys(planned).map((file) => format(path.join(ROOT, file))));
  Object.keys(planned).forEach((file) => process.stdout.write(`created ${file}\n`));
  if (register(n)) {
    process.stdout.write(`mounted /v1/${n.path} in src/routes/v1/index.js\n`);
  }
  if (registerMigration(n)) {
    process.stdout.write(`listed the migration in src/db/migrations/index.js\n`);
  }
  process.stdout.write(
    `\nNext steps:\n  1. Adjust the fields in src/db/migrations/${n.migration}.js, src/validations/${n.camel}.validation.js\n` +
      `     and src/services/${n.camel}.service.js\n` +
      `  2. Delete the records with the account: call ${n.camel}Service.removeAllOf(userId) in removeUserData (src/services/user.service.js)\n` +
      `  3. npm test\n`
  );
};

if (require.main?.filename === __filename) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { names };
