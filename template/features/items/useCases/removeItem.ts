import { Effect } from 'effect';
import type { ItemId } from '@/features/items/domain/entities/Item';
import { ItemNotFound } from '@/features/items/domain/errors/ItemNotFound';
import { ItemRepository } from '@/features/items/domain/repositories/ItemRepository';

/** Removes an item; one that is already gone is `ItemNotFound`. */
export const removeItem = (id: ItemId) =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository;
    const removed = yield* repo.remove(id);
    if (!removed) return yield* new ItemNotFound({ itemId: id });
  });
