// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

// Runs once when the MongoDB volume is created (docker-entrypoint-initdb.d).
// Creates the application user with access to the application database only.
const dbName = process.env.MONGO_APP_DATABASE;
const user = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!dbName || !user || !password) {
  throw new Error('MONGO_APP_DATABASE, MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required');
}

db.getSiblingDB(dbName).createUser({
  user,
  pwd: password,
  roles: [{ role: 'readWrite', db: dbName }],
});
