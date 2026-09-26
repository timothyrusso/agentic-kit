import { Context, type Effect } from 'effect';
import type { SqlError } from '@/features/core/error';
import type { Item, ItemDraft, ItemId } from '@/features/items/domain/entities/Item';
import type { ItemCorrupt } from '@/features/items/domain/errors/ItemCorrupt';

/** Where items are stored. */
export class ItemRepository extends Context.Tag('items/ItemRepository')<
  ItemRepository,
  {
    readonly list: Effect.Effect<readonly Item[], SqlError | ItemCorrupt>;
    readonly add: (draft: ItemDraft) => Effect.Effect<Item, SqlError | ItemCorrupt>;
    /** Succeeds with `false` when there was no such item. */
    readonly remove: (id: ItemId) => Effect.Effect<boolean, SqlError>;
  }
>() {}
