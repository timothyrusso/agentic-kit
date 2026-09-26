import { SqliteClient, trySql } from '@timothyrusso/effect-core';
import { Effect, Layer } from 'effect';
import { decodeItem, decodeItems } from '@/features/items/data/adapters/decodeItem';
import type { ItemRow } from '@/features/items/data/dtos/ItemRow';
import { ItemRepository } from '@/features/items/domain/repositories/ItemRepository';

/** `ItemRepository` over the app's SQLite database. */
export const ItemRepositoryLive = Layer.effect(
  ItemRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      list: trySql('list items', () => db.getAllAsync<ItemRow>('SELECT id, name, created_at FROM items')).pipe(
        Effect.flatMap(decodeItems),
      ),
      add: draft =>
        trySql('add item', () =>
          db.runAsync('INSERT INTO items (name, created_at) VALUES (?, ?)', [draft.name, draft.createdAt]),
        ).pipe(
          Effect.flatMap(result =>
            decodeItem({ id: result.lastInsertRowId, name: draft.name, created_at: draft.createdAt }),
          ),
        ),
      remove: id =>
        trySql('remove item', () => db.runAsync('DELETE FROM items WHERE id = ?', [id])).pipe(
          Effect.map(result => result.changes > 0),
        ),
    };
  }),
);
