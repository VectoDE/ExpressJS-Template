// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { MongoMemoryServer } = require('mongodb-memory-server');

// TEST_DATABASE_URL=mongodb-memory starts a throwaway MongoDB; any other value is used as it is
// (sqlite::memory: when unset). The CI matrix runs the suite against every supported database.
const startDatabase = async () => {
  if (process.env.TEST_DATABASE_URL === 'mongodb-memory') {
    const mongod = await MongoMemoryServer.create();
    globalThis.__MONGOD__ = mongod;
    process.env.TEST_DATABASE_URL = mongod.getUri();
  }
};

module.exports = startDatabase;
