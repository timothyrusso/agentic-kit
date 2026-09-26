import { Effect, Layer } from 'effect';
import { isAppError } from '../errors/appError.js';
import { type LogContext, Logger } from '../logger/logger.js';

/** One call a collecting logger received. */
export interface LogEntry {
  readonly level: 'error' | 'warn' | 'info' | 'debug';
  /** The message, or for `error` the error's `_tag` (or its string form). */
  readonly message: string;
  /** The value passed to `error`; `undefined` for the other levels. */
  readonly error: unknown;
  readonly context: LogContext;
}

/** What {@link collectLogs} returns. */
export interface CollectedLogs {
  /** A `Logger` Layer that records every call into `entries`. */
  readonly layer: Layer.Layer<Logger>;
  /** Every call so far, oldest first. */
  readonly entries: readonly LogEntry[];
  /** Empties `entries`. */
  clear(): void;
}

/**
 * A `Logger` that records instead of printing, to assert what the boundary logged.
 *
 * @example
 * ```ts
 * const logs = collectLogs();
 * const runtime = makeAppRuntime(Layer.merge(logs.layer, TripsTestLayer));
 * expect(logs.entries).toHaveLength(1);
 * ```
 */
export function collectLogs(): CollectedLogs {
  const entries: LogEntry[] = [];
  const record = (entry: LogEntry) => Effect.sync(() => void entries.push(entry));
  const layer = Layer.succeed(Logger, {
    error: (error, context = {}) =>
      record({ level: 'error', message: isAppError(error) ? error._tag : String(error), error, context }),
    warn: (message, context = {}) => record({ level: 'warn', message, error: undefined, context }),
    info: (message, context = {}) => record({ level: 'info', message, error: undefined, context }),
    debug: (message, context = {}) => record({ level: 'debug', message, error: undefined, context }),
  });
  return {
    layer,
    entries,
    clear: () => {
      entries.length = 0;
    },
  };
}
