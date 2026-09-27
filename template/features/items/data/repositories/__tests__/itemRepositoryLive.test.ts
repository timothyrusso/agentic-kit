import { SqliteClient } from '@timothyrusso/effect-core';
import { itEffect } from '@timothyrusso/effect-core/testing';
import { Effect, Layer } from 'effect';
import { makeSqliteTestLayer } from '@/features/core/testing';
import { ItemRepositoryLive } from '@/features/items/data/repositories/itemRepositoryLive';
import { ItemRepository } from '@/features/items/domain/repositories/ItemRepository';

const TestLayer = () => ItemRepositoryLive.pipe(Layer.provideMerge(makeSqliteTestLayer()));

describe('ItemRepositoryLive', () => {
  itEffect(
    'reads back what it added, with the id from the database',
    () =>
      Effect.gen(function* () {
        const repo = yield* ItemRepository;
        const added = yield* repo.add({ name: 'Milk', createdAt: 1 });
        expect(added).toEqual({ id: 1, name: 'Milk', createdAt: 1 });
        expect(yield* repo.list).toEqual([added]);
      }),
    TestLayer(),
  );

  itEffect(
    'removes an item, and reports false for one that is not there',
    () =>
      Effect.gen(function* () {
        const repo = yield* ItemRepository;
        const added = yield* repo.add({ name: 'Milk', createdAt: 1 });
        expect(yield* repo.remove(added.id)).toBe(true);
        expect(yield* repo.remove(added.id)).toBe(false);
        expect(yield* repo.list).toEqual([]);
      }),
    TestLayer(),
  );

  itEffect(
    'fails with ItemCorrupt on a row that does not decode',
    () =>
      Effect.gen(function* () {
        const db = yield* SqliteClient;
        yield* Effect.promise(() => db.runAsync("INSERT INTO items (name, created_at) VALUES ('  ', 1)"));
        const repo = yield* ItemRepository;
        const error = yield* Effect.flip(repo.list);
        expect(error._tag).toBe('ItemCorrupt');
      }),
    TestLayer(),
  );
});
