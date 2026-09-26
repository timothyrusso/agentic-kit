import { useMemo } from 'react';
import type { AnyAppError } from '../errors/appError.js';
import { type MessageKeyMapper, resolveMessageKey } from '../errors/messageKeys.js';

/**
 * The translated message for `error`, or `undefined` when there is none: looks the tag up in the
 * app's exhaustive `mapper` and passes the key to `t`.
 *
 * @example
 * ```ts
 * const message = useErrorMessage(trip.error, errorTagToMessageKey, t);
 * ```
 */
export function useErrorMessage<E extends AnyAppError, K extends string>(
  error: E | null | undefined,
  mapper: MessageKeyMapper<E, K>,
  t: (key: K) => string,
): string | undefined {
  return useMemo(() => (error ? t(resolveMessageKey(error, mapper)) : undefined), [error, mapper, t]);
}
