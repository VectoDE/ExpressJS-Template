const { MongoMemoryServer } = require('mongodb-memory-server');

const startDatabase = async () => {
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env.MONGODB_URI = mongod.getUri();
};

module.exports = startDatabase;
