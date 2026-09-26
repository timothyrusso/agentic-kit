import { advanceClock, itEffect } from '@timothyrusso/effect-core/testing';
import { Effect, Layer } from 'effect';
import type { Item, ItemId } from '@/features/items/domain/entities/Item';
import { ItemRepository } from '@/features/items/domain/repositories/ItemRepository';
import { addItem } from '@/features/items/useCases/addItem';
import { listItems } from '@/features/items/useCases/listItems';
import { removeItem } from '@/features/items/useCases/removeItem';

/** An in-memory `ItemRepository`, built straight from the Tag. */
const ItemRepositoryFake = (seed: readonly Item[] = []) =>
  Layer.sync(ItemRepository, () => {
    const items = new Map(seed.map(item => [item.id, item]));
    let nextId = Math.max(0, ...seed.map(item => item.id)) + 1;
    return {
      list: Effect.sync(() => [...items.values()]),
      add: draft =>
        Effect.sync(() => {
          const item = { ...draft, id: nextId++ as ItemId };
          items.set(item.id, item);
          return item;
        }),
      remove: id => Effect.sync(() => items.delete(id)),
    };
  });

const milk: Item = { id: 1 as ItemId, name: 'Milk', createdAt: 0 };

describe('addItem', () => {
  itEffect(
    'saves the normalised name with the current time',
    () =>
      Effect.gen(function* () {
        yield* advanceClock('1 second');
        const item = yield* addItem('  Buy   bread ');
        expect(item).toEqual({ id: 1, name: 'Buy bread', createdAt: 1000 });
      }),
    ItemRepositoryFake(),
  );

  itEffect(
    'fails with ItemNameEmpty on a blank name, saving nothing',
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(addItem('   '));
        expect(error._tag).toBe('ItemNameEmpty');
        expect(yield* listItems).toEqual([]);
      }),
    ItemRepositoryFake(),
  );
});

describe('listItems', () => {
  itEffect(
    'lists the newest first',
    () =>
      Effect.gen(function* () {
        yield* advanceClock('1 second');
        const bread = yield* addItem('Bread');
        expect(yield* listItems).toEqual([bread, milk]);
      }),
    ItemRepositoryFake([milk]),
  );
});

describe('removeItem', () => {
  itEffect(
    'removes the item, then fails with ItemNotFound',
    () =>
      Effect.gen(function* () {
        yield* removeItem(milk.id);
        const error = yield* Effect.flip(removeItem(milk.id));
        expect(error).toMatchObject({ _tag: 'ItemNotFound', itemId: milk.id });
      }),
    ItemRepositoryFake([milk]),
  );
});
