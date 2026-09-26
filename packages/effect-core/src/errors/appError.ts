import { type Cause, Data } from 'effect';

/**
 * The shape every app error shares: a `_tag` naming the class, a `messageKey` into the app's
 * catalog, and an optional `cause` (the original exception, a parse error, a failed response).
 * An app's closed `AppError` union is a union of classes declared with {@link AppErrorBase}.
 */
export interface AnyAppError {
  readonly _tag: string;
  readonly messageKey: string;
  readonly cause?: unknown;
}

/** The fields a subclass declares, minus the ones {@link AppErrorBase} owns. */
type AppErrorFields<A> = { readonly [P in keyof A as P extends '_tag' | 'messageKey' ? never : P]: A[P] };

/**
 * Constructor arguments: the declared fields plus an optional `cause`. The argument itself is
 * optional when every declared field is.
 */
export type AppErrorArgs<A> =
  Record<never, never> extends AppErrorFields<A>
    ? [args?: AppErrorFields<A> & { readonly cause?: unknown }]
    : [args: AppErrorFields<A> & { readonly cause?: unknown }];

/** An instance of a class declared with {@link AppErrorBase}. */
export type AppErrorInstance<Tag extends string, Key extends string, A> = Cause.YieldableError & {
  readonly _tag: Tag;
  readonly messageKey: Key;
} & Readonly<A>;

/**
 * The class {@link AppErrorBase} returns. Extend it with the error's own fields as the type
 * argument; `messageKey` is available on the class and on every instance.
 */
export interface AppErrorClass<Tag extends string, Key extends string> {
  new <A extends Record<string, unknown> = Record<never, never>>(
    ...args: AppErrorArgs<A>
  ): AppErrorInstance<Tag, Key, A>;
  readonly messageKey: Key;
}

/**
 * Declares a `Data.TaggedError` class that carries a catalog `messageKey` and accepts an optional
 * `cause`. Instances are yieldable in `Effect.gen`, compare structurally and are real `Error`s.
 *
 * @example
 * ```ts
 * export class TripNotFound extends AppErrorBase('TripNotFound', 'errors.tripNotFound')<{
 *   readonly tripId: string;
 * }> {}
 *
 * yield* new TripNotFound({ tripId, cause: response });
 * ```
 */
export function AppErrorBase<const Tag extends string, const Key extends string>(
  tag: Tag,
  messageKey: Key,
): AppErrorClass<Tag, Key> {
  class Base extends Data.TaggedError(tag)<{ readonly cause?: unknown }> {
    static readonly messageKey = messageKey;
    readonly messageKey = messageKey;
  }
  // NOTE: Data.TaggedError's constructor is generic in the fields; this class keeps that
  // signature and adds messageKey, which TypeScript cannot express on the class expression itself.
  return Base as unknown as AppErrorClass<Tag, Key>;
}

/** True for any value shaped like an app error: an object with a string `_tag` and `messageKey`. */
export function isAppError(value: unknown): value is AnyAppError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { readonly _tag?: unknown; readonly messageKey?: unknown };
  return typeof candidate._tag === 'string' && typeof candidate.messageKey === 'string';
}
