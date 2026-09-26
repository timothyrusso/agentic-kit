import { runMigrations, SqlError, SqliteClient, trySql } from '@timothyrusso/effect-core';
import { Effect, Layer } from 'effect';
import { openDatabaseAsync } from 'expo-sqlite';
import { AppConfig } from '@/features/core/config';
import { migrations } from '@/features/core/sqlite/data/migrations';

/** Opens the app database named in the config, switches foreign keys on and migrates it. */
export const SqliteLive = Layer.effect(
  SqliteClient,
  Effect.gen(function* () {
    const config = yield* AppConfig.Config;
    const db = yield* Effect.tryPromise({
      try: () => openDatabaseAsync(config.databaseName),
      catch: cause => new SqlError({ message: `open ${config.databaseName}`, cause }),
    });
    yield* trySql('enable foreign keys', () => db.execAsync('PRAGMA foreign_keys = ON;'));
    yield* runMigrations(db, migrations);
    return db;
  }),
);
