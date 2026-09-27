import { type AnyAppError, AppErrorBase } from './appError.js';

/**
 * The one error that is not a domain failure: a defect, a thrown exception or a rejection nobody
 * anticipated. The runtime boundary turns every defect into this, and `toAppError` wraps unknown
 * values in it. `cause` holds the original value.
 */
export class UnexpectedError extends AppErrorBase('UnexpectedError', 'errors.unexpected')<{
  readonly cause: unknown;
}> {}

/**
 * Turns an unknown thrown value into an app error, for the `catch` callback of
 * `Effect.tryPromise` and `Effect.try`. An `UnexpectedError` passes through unchanged; anything
 * else is wrapped as its `cause`. Pass `isKnown` to let the app's own errors through as they are.
 *
 * @example
 * ```ts
 * Effect.tryPromise({ try: () => api.trip(id), catch: toAppError });
 * Effect.tryPromise({ try: () => repo.save(trip), catch: cause => toAppError(cause, isTripError) });
 * ```
 */
export function toAppError(cause: unknown): UnexpectedError;
export function toAppError<E extends AnyAppError>(
  cause: unknown,
  isKnown: (value: unknown) => value is E,
): E | UnexpectedError;
export function toAppError<E extends AnyAppError>(
  cause: unknown,
  isKnown?: (value: unknown) => value is E,
): E | UnexpectedError {
  if (cause instanceof UnexpectedError) return cause;
  if (isKnown?.(cause)) return cause;
  return new UnexpectedError({ cause });
}
