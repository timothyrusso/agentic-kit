import type { ItemSchema } from '@/features/items/domain/schemas/ItemSchema';

export type { ItemId } from '@/features/items/domain/schemas/ItemSchema';

/** Something on the list: a name, and when it was added (epoch milliseconds). */
export type Item = typeof ItemSchema.Type;

/** What a new item is saved from; the id comes from the database. */
export interface ItemDraft {
  readonly name: string;
  readonly createdAt: number;
}
