import { Clock, Effect } from 'effect';
import { ItemNameEmpty } from '@/features/items/domain/errors/ItemNameEmpty';
import { ItemRepository } from '@/features/items/domain/repositories/ItemRepository';
import { normalizeItemName } from '@/features/items/domain/utils/itemRules';

/** Adds an item named `name`, stamped with the current time. A blank name is `ItemNameEmpty`. */
export const addItem = (name: string) =>
  Effect.gen(function* () {
    const normalized = normalizeItemName(name);
    if (normalized === '') return yield* new ItemNameEmpty();
    const repo = yield* ItemRepository;
    const createdAt = yield* Clock.currentTimeMillis;
    return yield* repo.add({ name: normalized, createdAt });
  });
