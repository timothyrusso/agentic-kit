import { Schema } from 'effect';
import { ItemSchema } from '@/features/items/domain/schemas/ItemSchema';

/** A row of the `items` table. */
export const ItemRow = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  created_at: Schema.Number,
});
export type ItemRow = typeof ItemRow.Type;

/** A row to an `Item`, and back. */
export const ItemFromRow = Schema.transform(ItemRow, ItemSchema, {
  strict: true,
  decode: row => ({ id: row.id, name: row.name, createdAt: row.created_at }),
  encode: item => ({ id: item.id, name: item.name, created_at: item.createdAt }),
});
