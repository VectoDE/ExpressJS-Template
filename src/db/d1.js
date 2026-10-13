// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

const Client_SQLite3 = require('knex/lib/dialects/sqlite3');
const SqliteQueryCompiler = require('knex/lib/dialects/sqlite3/query/sqlite-querycompiler');

/**
 * Knex client for Cloudflare D1, used by the live demo on Cloudflare Workers (DATABASE_URL=d1:<binding>).
 * D1 speaks SQLite, so query building is the SQLite dialect; only the execution goes through the binding.
 *
 * D1 has no BEGIN/COMMIT over this interface. Transaction statements are accepted and ignored, so the
 * statements of a Knex transaction run one by one and a rollback undoes nothing. That is why D1 is only
 * allowed with DEMO_MODE (see src/config/config.js).
 */
const bindings = new Map();

// The Worker entry registers the binding from `env`; Node never does, so a d1: URL fails there with a clear error.
const registerD1Binding = (name, binding) => {
  bindings.set(name, binding);
};

const TRANSACTION_CONTROL = /^\s*(begin|commit|end|rollback|savepoint|release)\b/i;

// D1 reports constraint errors only in the message; the SQL adapter recognises them by the SQLite code.
const normaliseError = (error) => {
  const message = String(error?.message || '');
  if (/UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(message) && !error.code) {
    error.code = /UNIQUE/i.test(message) ? 'SQLITE_CONSTRAINT_UNIQUE' : 'SQLITE_CONSTRAINT';
  }
  return error;
};

/**
 * Knex writes a multi-row insert for SQLite as `insert ... select ? union all select ?`, and D1 rejects compound
 * selects with more than a few terms. Plain inserts of several rows use a VALUES list instead.
 */
class D1QueryCompiler extends SqliteQueryCompiler {
  insert() {
    const rows = this.single.insert;
    const { onConflict, returning } = this.single;
    if (!Array.isArray(rows) || rows.length < 2 || onConflict || returning) {
      return super.insert();
    }
    const data = this._prepInsert(rows);
    if (typeof data === 'string' || data.columns.length === 0) {
      return super.insert();
    }
    const values = data.values
      .map(
        (row) => `(${this.client.parameterize(row, this.client.valueForUndefined, this.builder, this.bindingsHolder)})`
      )
      .join(', ');
    return {
      sql: `${this.with()}insert into ${this.tableName} (${this.formatter.columnize(data.columns)}) values ${values}`,
    };
  }
}

class ClientD1 extends Client_SQLite3 {
  queryCompiler(builder, formatter) {
    return new D1QueryCompiler(this, builder, formatter);
  }

  _driver() {
    return {};
  }

  /**
   * No connection pool. The binding is not a connection, any number of queries can share it, and a pool
   * would resolve one request's promises from another request, which Workers refuse. Every query gets a
   * small handle of its own, so Knex can mark it (transactions do) without touching the binding.
   */
  initializePool() {
    this.pool = { destroy: async () => {} };
    this._ownsPool = true;
  }

  async acquireRawConnection() {
    const name = this.connectionSettings?.binding || 'DB';
    const binding = bindings.get(name);
    if (!binding) {
      throw new Error(`No D1 binding named "${name}" is registered; D1 only works inside a Cloudflare Worker`);
    }
    return { binding };
  }

  acquireConnection() {
    return this.acquireRawConnection();
  }

  releaseConnection() {
    return Promise.resolve();
  }

  // D1 bindings hold no connection of their own, so there is nothing to close.
  destroyRawConnection() {
    return Promise.resolve();
  }

  validateConnection() {
    return true;
  }

  _formatBindings(values) {
    return (values || []).map((value) => {
      if (value instanceof Date) return value.valueOf();
      if (typeof value === 'boolean') return Number(value);
      // D1 rejects undefined; SQL NULL is what SQLite would store.
      if (value === undefined) return null;
      return value;
    });
  }

  async _query(connection, obj) {
    if (!obj.sql) throw new Error('The query is empty');
    if (!connection) throw new Error('No connection provided');
    if (TRANSACTION_CONTROL.test(obj.sql)) {
      obj.response = [];
      obj.context = { lastID: undefined, changes: 0 };
      return obj;
    }
    const values = this._formatBindings(obj.bindings);
    let result;
    try {
      const statement = connection.binding.prepare(obj.sql);
      result = await (values.length ? statement.bind(...values) : statement).all();
    } catch (error) {
      throw normaliseError(error);
    }
    obj.response = result?.results || [];
    obj.context = { lastID: result?.meta?.last_row_id, changes: result?.meta?.changes ?? 0 };
    return obj;
  }
}

Object.assign(ClientD1.prototype, { driverName: 'd1' });

module.exports = { ClientD1, registerD1Binding };
