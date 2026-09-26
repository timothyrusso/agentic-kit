import type { AnyAppError } from '../errors/appError.js';
import type { UnexpectedError } from '../errors/unexpected.js';

/**
 * The app registers its runtime's services and its closed error union here, once, so
 * `useEffectQuery` and `useEffectMutation` accept only `Effect<A, AppError, AppServices>` and
 * type `error` as `AppError`:
 *
 * @example
 * ```ts
 * declare module '@timothyrusso/effect-core/react' {
 *   interface Register {
 *     services: AppServices;
 *     error: AppError;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: the app fills it in through module augmentation
export interface Register {}

/** The registered `AppServices`, or `never` until the app registers them. */
export type RegisteredServices = Register extends { readonly services: infer R } ? R : never;

/** The registered `AppError` union, or any app error until the app registers one. */
export type RegisteredError = Register extends { readonly error: infer E extends AnyAppError } ? E : AnyAppError;

/** The `error` a hook reports: the registered union, plus the `UnexpectedError` a defect becomes. */
export type EffectHookError = RegisteredError | UnexpectedError;
