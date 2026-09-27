import { Schema } from 'effect';

/** What the `extra` block of `app.json` must hold. A missing or invalid field fails the boot. */
export const AppConfigSchema = Schema.Struct({
  databaseName: Schema.NonEmptyTrimmedString,
});

export type AppConfigValues = typeof AppConfigSchema.Type;
