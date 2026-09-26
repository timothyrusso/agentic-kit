import { Effect } from 'effect';
import { ItemRepository } from '@/features/items/domain/repositories/ItemRepository';
import { byNewestFirst } from '@/features/items/domain/utils/itemRules';

/** Every item, newest first. */
export const listItems = Effect.gen(function* () {
  const repo = yield* ItemRepository;
  const items = yield* repo.list;
  return [...items].sort(byNewestFirst);
});
