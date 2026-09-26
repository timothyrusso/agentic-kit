import { runMigrations, SqliteClient } from '@timothyrusso/effect-core';
import { itEffect, makeNodeSqliteLayer } from '@timothyrusso/effect-core/testing';
import { Effect } from 'effect';
import { migrations } from '@/features/core/sqlite/data/migrations';

const lastVersion = Math.max(...migrations.map(migration => migration.version));

describe('migrations', () => {
  itEffect(
    'bring an empty database to the last version, and run again as a no-op',
    Effect.gen(function* () {
      const db = yield* SqliteClient;
      const first = yield* runMigrations(db, migrations);
      expect(first).toEqual({ from: 0, to: lastVersion, applied: migrations.map(m => m.version) });
      const second = yield* runMigrations(db, migrations);
      expect(second.applied).toEqual([]);
    }),
    makeNodeSqliteLayer(),
  );
});
