const os = require('node:os');
const mongoose = require('mongoose');

const connect = async () => {
  // Jest's sandbox cannot run the driver's dynamic import('os'); hand the module over directly.
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: `test_${process.env.JEST_WORKER_ID || 0}`,
    runtimeAdapters: { os },
  });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};

const clear = async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
};

const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

// Registers connect / clear / disconnect hooks for a test file.
const useDatabase = () => {
  beforeAll(connect);
  afterEach(clear);
  afterAll(disconnect);
};

module.exports = { connect, clear, disconnect, useDatabase };
