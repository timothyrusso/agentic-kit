import { Effect, Schema } from 'effect';
import { ItemFromRow } from '@/features/items/data/dtos/ItemRow';
import { ItemCorrupt } from '@/features/items/domain/errors/ItemCorrupt';

/** Decodes one row; a row that does not fit is `ItemCorrupt`, and nothing else is caught. */
export const decodeItem = (row: unknown) =>
  Schema.decodeUnknown(ItemFromRow)(row).pipe(Effect.mapError(cause => new ItemCorrupt({ cause })));

export const decodeItems = (rows: unknown) =>
  Schema.decodeUnknown(Schema.Array(ItemFromRow))(rows).pipe(Effect.mapError(cause => new ItemCorrupt({ cause })));
