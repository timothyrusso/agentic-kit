import { Context, Effect } from 'effect';
import { AppErrorBase } from '../errors/appError.js';

/** A value SQLite can bind: the same set expo-sqlite accepts. */
export type SqlValue = string | number | null | boolean | Uint8Array | ArrayBuffer;

/** Positional (`?`) or named (`$name`) parameters. */
export type SqlParams = SqlValue[] | Record<string, SqlValue>;

/** What a write reports. */
export interface SqlRunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

/**
 * The slice of expo-sqlite's async `SQLiteDatabase` API the kit relies on. An expo-sqlite
 * database satisfies it as it is, so the app's Live Layer is one line:
 *
 * @example
 * ```ts
 * export const SqliteLive = Layer.effect(
 *   SqliteClient,
 *   Effect.promise(() => SQLite.openDatabaseAsync('app.db')),
 * );
 * ```
 */
export interface SqliteDatabase {
  /** Runs one or more statements without parameters (DDL, pragmas). */
  execAsync(source: string): Promise<void>;
  /** Runs a write. */
  runAsync(source: string, params?: SqlParams): Promise<SqlRunResult>;
  /** Every row of a query. */
  getAllAsync<T>(source: string, params?: SqlParams): Promise<T[]>;
  /** The first row of a query, or `null`. */
  getFirstAsync<T>(source: string, params?: SqlParams): Promise<T | null>;
  /** Runs `task` in a transaction; other queries on the connection may interleave. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  /** Runs `task` in an exclusive transaction; use `txn` for every statement inside it. */
  withExclusiveTransactionAsync(task: (txn: SqliteDatabase) => Promise<void>): Promise<void>;
}

/**
 * The app's database connection. The kit ships the interface and the Node test Layer
 * (`makeNodeSqliteLayer` in `/testing`); the expo-sqlite Live Layer lives in the app.
 */
export class SqliteClient extends Context.Tag('@timothyrusso/effect-core/SqliteClient')<
  SqliteClient,
  SqliteDatabase
>() {}

/** A statement or a transaction failed. `cause` is the driver's error. */
export class SqlError extends AppErrorBase('SqlError', 'errors.sql')<{ readonly message: string }> {}

function messageOf(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string') {
    return cause.message;
  }
  return String(cause);
}

/**
 * Runs `query` against the connection in the context, failing with a {@link SqlError} when its
 * promise rejects. `operation` names the call in the error message.
 *
 * @example
 * ```ts
 * const trips = withSqlite('list trips', db => db.getAllAsync<TripRow>('SELECT * FROM trips'));
 * ```
 */
export function withSqlite<A>(
  operation: string,
  query: (db: SqliteDatabase) => Promise<A>,
): Effect.Effect<A, SqlError, SqliteClient> {
  return Effect.flatMap(SqliteClient, db => trySql(operation, () => query(db)));
}

/** `Effect.tryPromise` with the rejection mapped to a {@link SqlError}. */
export function trySql<A>(operation: string, run: () => Promise<A>): Effect.Effect<A, SqlError> {
  return Effect.tryPromise({
    try: run,
    catch: cause => new SqlError({ message: `${operation}: ${messageOf(cause)}`, cause }),
  });
}
