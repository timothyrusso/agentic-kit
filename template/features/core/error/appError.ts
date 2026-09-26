import type { ConfigError, SqlError, UnexpectedError } from '@timothyrusso/effect-core';

/** Each feature adds `<feature>: <its error union>` here from its `domain/errors/index.ts`. */
export interface AppErrorRegistry {
  core: UnexpectedError | SqlError | ConfigError;
}

/** The closed union of every error that can reach the UI. */
export type AppError = AppErrorRegistry[keyof AppErrorRegistry];
