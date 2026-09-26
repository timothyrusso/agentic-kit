import { Context, Effect, Layer } from 'effect';

/** Structured data attached to a log line: a query key, an id, the operation that failed. */
export type LogContext = Readonly<Record<string, unknown>>;

/** The logging service. Every method returns an Effect that never fails. */
export interface LoggerService {
  /** An error worth reporting (a Sentry Layer sends these). */
  readonly error: (error: unknown, context?: LogContext) => Effect.Effect<void>;
  readonly warn: (message: string, context?: LogContext) => Effect.Effect<void>;
  readonly info: (message: string, context?: LogContext) => Effect.Effect<void>;
  readonly debug: (message: string, context?: LogContext) => Effect.Effect<void>;
}

/**
 * The app's logger. Use cases do not log: the runtime boundary (`useEffectQuery`,
 * `useEffectMutation`) logs each failure once. Apps provide {@link ConsoleLogger} in development
 * and their own Layer (Sentry, for example) in release builds.
 */
export class Logger extends Context.Tag('@timothyrusso/effect-core/Logger')<Logger, LoggerService>() {}

/** Writes to the console, with the context as a second argument. */
export const ConsoleLogger: Layer.Layer<Logger> = Layer.succeed(Logger, {
  // biome-ignore lint/suspicious/noConsole: this Layer is the console sink
  error: (error, context = {}) => Effect.sync(() => console.error(error, context)),
  // biome-ignore lint/suspicious/noConsole: this Layer is the console sink
  warn: (message, context = {}) => Effect.sync(() => console.warn(message, context)),
  // biome-ignore lint/suspicious/noConsole: this Layer is the console sink
  info: (message, context = {}) => Effect.sync(() => console.info(message, context)),
  // biome-ignore lint/suspicious/noConsole: this Layer is the console sink
  debug: (message, context = {}) => Effect.sync(() => console.debug(message, context)),
});

/** Discards everything. For tests that do not assert on logs, and for silent builds. */
export const NoopLogger: Layer.Layer<Logger> = Layer.succeed(Logger, {
  error: () => Effect.void,
  warn: () => Effect.void,
  info: () => Effect.void,
  debug: () => Effect.void,
});
