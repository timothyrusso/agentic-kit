import { Effect, Exit } from 'effect';
import { makeNodeSqliteLayer } from '../../testing/nodeSqlite.js';
import { itEffect, runTest } from '../../testing/runTest.js';
import { type Migration, runMigrations } from '../migrations.js';
import { SqlError, SqliteClient, withSqlite } from '../sqliteClient.js';

const v1: Migration = { version: 1, up: 'CREATE TABLE trips (id TEXT PRIMARY KEY, name TEXT NOT NULL);' };
const v2: Migration = {
  version: 2,
  up: async txn => {
    await txn.execAsync('ALTER TABLE trips ADD COLUMN starts_at TEXT;');
    await txn.runAsync('INSERT INTO trips (id, name) VALUES (?, ?)', ['seed', 'Seed trip']);
  },
};
const v3: Migration = { version: 3, up: 'CREATE TABLE stops (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL);' };
const failingV3: Migration = {
  version: 3,
  up: 'CREATE TABLE stops (id TEXT PRIMARY KEY); INSERT INTO nowhere VALUES (1);',
};

const userVersion = withSqlite('read user_version', db =>
  db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'),
).pipe(Effect.map(row => row?.user_version));

const tables = withSqlite('list tables', db =>
  db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"),
).pipe(Effect.map(rows => rows.map(row => row.name)));

const migrate = (migrations: readonly Migration[]) =>
  Effect.flatMap(SqliteClient, client => runMigrations(client, migrations));

describe('runMigrations on makeNodeSqliteLayer', () => {
  itEffect(
    'applies v1..vN in version order and records the last in user_version',
    Effect.gen(function* () {
      const report = yield* migrate([v3, v1, v2]);
      expect(report).toEqual({ from: 0, to: 3, applied: [1, 2, 3] });
      expect(yield* userVersion).toBe(3);
      expect(yield* tables).toEqual(['stops', 'trips']);
      const seed = yield* withSqlite('read seed', db =>
        db.getFirstAsync<{ name: string; starts_at: string | null }>('SELECT name, starts_at FROM trips'),
      );
      expect(seed).toEqual({ name: 'Seed trip', starts_at: null });
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'is idempotent, and applies only the steps above user_version',
    Effect.gen(function* () {
      yield* migrate([v1, v2]);
      expect(yield* migrate([v1, v2])).toEqual({ from: 2, to: 2, applied: [] });
      expect(yield* migrate([v1, v2, v3])).toEqual({ from: 2, to: 3, applied: [3] });
      expect(yield* userVersion).toBe(3);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'rolls back a failing step entirely, leaving user_version at the last good step',
    Effect.gen(function* () {
      yield* migrate([v1, v2]);
      const error = yield* Effect.flip(migrate([v1, v2, failingV3]));
      expect(error).toBeInstanceOf(SqlError);
      expect(error.message).toContain('migration 3');
      expect(error.cause).toMatchObject({ message: expect.stringContaining('no such table') });
      expect(yield* userVersion).toBe(2);
      expect(yield* tables).toEqual(['trips']);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'on a fresh database, keeps the steps before the failing one',
    Effect.gen(function* () {
      const error = yield* Effect.flip(migrate([v1, failingV3]));
      expect(error._tag).toBe('SqlError');
      expect(yield* userVersion).toBe(1);
      expect(yield* tables).toEqual(['trips']);
    }),
    makeNodeSqliteLayer(),
  );

  it('treats a duplicate or non-integer version as a defect', async () => {
    const duplicate = await runTest(Effect.exit(migrate([v1, { ...v3, version: 1 }])), makeNodeSqliteLayer());
    expect(Exit.isFailure(duplicate) && duplicate.cause._tag).toBe('Die');
    const fractional = await runTest(Effect.exit(migrate([{ ...v1, version: 1.5 }])), makeNodeSqliteLayer());
    expect(Exit.isFailure(fractional) && fractional.cause._tag).toBe('Die');
  });
});

describe('makeNodeSqliteLayer', () => {
  itEffect(
    'binds positional and named parameters, booleans as integers, and returns plain rows',
    Effect.gen(function* () {
      yield* withSqlite('create', db =>
        db.execAsync('CREATE TABLE flags (id INTEGER PRIMARY KEY, name TEXT, on_ INTEGER)'),
      );
      const first = yield* withSqlite('insert', db =>
        db.runAsync('INSERT INTO flags (name, on_) VALUES (?, ?)', ['a', true]),
      );
      expect(first).toEqual({ lastInsertRowId: 1, changes: 1 });
      yield* withSqlite('insert named', db =>
        db.runAsync('INSERT INTO flags (name, on_) VALUES ($name, $on)', { $name: 'b', $on: false }),
      );
      const rows = yield* withSqlite('select', db =>
        db.getAllAsync<{ name: string; on_: number }>('SELECT name, on_ FROM flags'),
      );
      expect(rows).toStrictEqual([
        { name: 'a', on_: 1 },
        { name: 'b', on_: 0 },
      ]);
      expect(yield* withSqlite('none', db => db.getFirstAsync('SELECT * FROM flags WHERE id = ?', [99]))).toBeNull();
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'rolls back withTransactionAsync when the task throws, and gives each test a fresh database',
    Effect.gen(function* () {
      expect(yield* tables).toEqual([]);
      yield* withSqlite('create', db => db.execAsync('CREATE TABLE t (n INTEGER)'));
      const failed = yield* Effect.flip(
        withSqlite('transaction', db =>
          db.withTransactionAsync(async () => {
            await db.runAsync('INSERT INTO t VALUES (1)');
            throw new Error('abort');
          }),
        ),
      );
      expect(failed.message).toBe('transaction: abort');
      expect(yield* withSqlite('count', db => db.getAllAsync('SELECT * FROM t'))).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );

  itEffect(
    'fails with SqlError on bad SQL',
    Effect.gen(function* () {
      const error = yield* Effect.flip(withSqlite('bad', db => db.execAsync('SELEC nothing')));
      expect(error).toBeInstanceOf(SqlError);
      expect(error.messageKey).toBe('errors.sql');
    }),
    makeNodeSqliteLayer(),
  );
});
