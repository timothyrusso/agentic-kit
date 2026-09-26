import type { AnyAppError } from './appError.js';
import type { UnexpectedError } from './unexpected.js';

/**
 * One catalog key per error tag of `E`. Being a mapped type over the tags, a missing tag is a
 * compile error and so is a tag that is not in the union.
 */
export type MessageKeyMapper<E extends AnyAppError, K extends string = string> = {
  readonly [Tag in E['_tag']]: K;
};

/** What {@link defineAppErrors} returns: helpers bound to the app's closed error union. */
export interface AppErrors<E extends AnyAppError> {
  /**
   * Returns `mapper` unchanged. Its only job is the type check: every tag of the union, plus
   * `UnexpectedError`, has a key, and no other tag does.
   */
  assertExhaustiveMessageKeys<K extends string>(
    mapper: MessageKeyMapper<E | UnexpectedError, K>,
  ): MessageKeyMapper<E | UnexpectedError, K>;
}

/**
 * Declares the app's closed error union once, in `features/core/error`.
 *
 * @example
 * ```ts
 * export type AppError = TripNotFound | SqlError | ConfigError | UnexpectedError;
 * const appErrors = defineAppErrors<AppError>();
 * export const errorTagToMessageKey = appErrors.assertExhaustiveMessageKeys({
 *   TripNotFound: 'errors.tripNotFound',
 *   SqlError: 'errors.storage',
 *   ConfigError: 'errors.config',
 *   UnexpectedError: 'errors.unexpected',
 * });
 * ```
 */
export function defineAppErrors<E extends AnyAppError>(): AppErrors<E> {
  return {
    assertExhaustiveMessageKeys: mapper => mapper,
  };
}

/** The catalog key `mapper` gives `error`. */
export function resolveMessageKey<E extends AnyAppError, K extends string>(
  error: E,
  mapper: MessageKeyMapper<E, K>,
): K {
  const tag: E['_tag'] = error._tag;
  return mapper[tag];
}
