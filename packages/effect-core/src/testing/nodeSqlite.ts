import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { Effect, Layer } from 'effect';
import { SqliteClient, type SqliteDatabase, type SqlParams, type SqlValue } from '../sqlite/sqliteClient.js';

/** A {@link SqliteDatabase} over `node:sqlite`, plus `close`. */
export interface NodeSqliteDatabase extends SqliteDatabase {
  /** Closes the connection. The Layer does this when it is released. */
  close(): void;
}

/** Options for {@link makeNodeSqliteDatabase}. */
export interface NodeSqliteOptions {
  /** A file path, or `:memory:` (the default). */
  readonly path?: string;
  /** Runs `PRAGMA foreign_keys = ON` on open. Default `true`, as most apps enable it. */
  readonly foreignKeys?: boolean;
}

function bindValue(value: SqlValue): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

/** Calls `positional` with `?` parameters or `named` with `$name` parameters. */
function bind<T>(
  params: SqlParams | undefined,
  positional: (values: SQLInputValue[]) => T,
  named: (values: Record<string, SQLInputValue>) => T,
): T {
  if (params === undefined) return positional([]);
  if (Array.isArray(params)) return positional(params.map(bindValue));
  return named(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, bindValue(value)])));
}

/**
 * An in-memory SQLite database behind the {@link SqliteDatabase} interface, so repositories and
 * migrations run real SQL in jest. `node:sqlite` ships with Node 22; it is synchronous, and each
 * async method resolves with its answer. Rows are plain objects. Transactions run on the one
 * connection, which is enough to test that a failure rolls everything back.
 */
export function makeNodeSqliteDatabase(options: NodeSqliteOptions = {}): NodeSqliteDatabase {
  const db = new DatabaseSync(options.path ?? ':memory:');
  if (options.foreignKeys ?? true) db.exec('PRAGMA foreign_keys = ON;');

  async function transaction(task: () => Promise<void>, begin: string): Promise<void> {
    db.exec(begin);
    try {
      await task();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const handle: NodeSqliteDatabase = {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params) {
      const statement = db.prepare(source);
      const result = bind(
        params,
        values => statement.run(...values),
        values => statement.run(values),
      );
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync<T>(source: string, params?: SqlParams) {
      const statement = db.prepare(source);
      const rows = bind(
        params,
        values => statement.all(...values),
        values => statement.all(values),
      );
      return rows.map(row => ({ ...row }) as T);
    },
    async getFirstAsync<T>(source: string, params?: SqlParams) {
      const statement = db.prepare(source);
      const row = bind(
        params,
        values => statement.get(...values),
        values => statement.get(values),
      );
      return row === undefined ? null : ({ ...row } as T);
    },
    withTransactionAsync: task => transaction(task, 'BEGIN'),
    withExclusiveTransactionAsync: task => transaction(() => task(handle), 'BEGIN EXCLUSIVE'),
    close() {
      db.close();
    },
  };
  return handle;
}

/**
 * A `SqliteClient` Layer over a fresh {@link makeNodeSqliteDatabase}, closed when the Layer is
 * released. Each `runTest` or `itEffect` builds its own, so tests never share a database.
 */
export function makeNodeSqliteLayer(options: NodeSqliteOptions = {}): Layer.Layer<SqliteClient> {
  return Layer.scoped(
    SqliteClient,
    Effect.acquireRelease(
      Effect.sync(() => makeNodeSqliteDatabase(options)),
      db => Effect.sync(() => db.close()),
    ),
  );
}
