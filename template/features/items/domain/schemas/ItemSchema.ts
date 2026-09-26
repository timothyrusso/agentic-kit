import { Schema } from 'effect';

/** An item's id: the SQLite row id, a positive integer. */
export const ItemId = Schema.Int.pipe(Schema.positive(), Schema.brand('ItemId'));
export type ItemId = typeof ItemId.Type;

export const ItemSchema = Schema.Struct({
  id: ItemId,
  name: Schema.NonEmptyTrimmedString,
  createdAt: Schema.Int,
});
