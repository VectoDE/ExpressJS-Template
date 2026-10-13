// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const stopDatabase = async () => {
  await globalThis.__MONGOD__?.stop();
};

module.exports = stopDatabase;
