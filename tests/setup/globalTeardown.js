const stopDatabase = async () => {
  await globalThis.__MONGOD__?.stop();
};

module.exports = stopDatabase;
