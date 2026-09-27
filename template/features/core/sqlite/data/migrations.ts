import type { Migration } from '@timothyrusso/effect-core';

/**
 * The schema, one step per version. Never edit a released step: add the next version. A step that
 * touches references runs `PRAGMA foreign_key_check` itself, since foreign keys are off inside a
 * migration's transaction.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    up: `CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
  },
];
