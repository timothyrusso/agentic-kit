import { Effect } from 'effect';
import { type SqlError, type SqliteDatabase, trySql } from './sqliteClient.js';

/**
 * One schema step. `version` is a positive integer; `up` is SQL for `execAsync` or a function
 * that runs its statements on the transaction it receives.
 */
export interface Migration {
  readonly version: number;
  readonly up: string | ((txn: SqliteDatabase) => Promise<void>);
}

/** What {@link runMigrations} did: the version before and after, and each version it applied. */
export interface MigrationReport {
  readonly from: number;
  readonly to: number;
  readonly applied: readonly number[];
}

function validate(migrations: readonly Migration[]): Effect.Effect<readonly Migration[]> {
  const seen = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      return Effect.dieMessage(`Migration version ${migration.version} is not a positive integer`);
    }
    if (seen.has(migration.version)) {
      return Effect.dieMessage(`Migration version ${migration.version} is declared twice`);
    }
    seen.add(migration.version);
  }
  return Effect.succeed([...migrations].sort((a, b) => a.version - b.version));
}

/**
 * Brings the database to the highest version in `migrations`, keyed by `PRAGMA user_version`.
 * Each pending migration runs, in version order, in its own exclusive transaction together with
 * the `user_version` bump, so a failing step rolls back entirely and leaves `user_version` at the
 * last step that succeeded. Running it again is a no-op. A duplicate or non-integer version is a
 * defect.
 *
 * @example
 * ```ts
 * yield* runMigrations(db, [
 *   { version: 1, up: 'CREATE TABLE trips (id TEXT PRIMARY KEY, name TEXT NOT NULL);' },
 *   { version: 2, up: 'ALTER TABLE trips ADD COLUMN starts_at TEXT;' },
 * ]);
 * ```
 */
export function runMigrations(
  client: SqliteDatabase,
  migrations: readonly Migration[],
): Effect.Effect<MigrationReport, SqlError> {
  return Effect.gen(function* () {
    const ordered = yield* validate(migrations);
    const row = yield* trySql('read user_version', () =>
      client.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
    );
    const from = row?.user_version ?? 0;
    const pending = ordered.filter(migration => migration.version > from);
    for (const migration of pending) {
      yield* trySql(`migration ${migration.version}`, () =>
        client.withExclusiveTransactionAsync(async txn => {
          if (typeof migration.up === 'string') await txn.execAsync(migration.up);
          else await migration.up(txn);
          await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
        }),
      );
    }
    return { from, to: pending.at(-1)?.version ?? from, applied: pending.map(migration => migration.version) };
  });
}
