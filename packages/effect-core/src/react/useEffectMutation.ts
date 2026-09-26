import { type UseMutationOptions, type UseMutationResult, useMutation } from '@tanstack/react-query';
import type { Effect } from 'effect';
import { useAppRuntime } from './EffectRuntimeProvider.js';
import type { EffectHookError, RegisteredError, RegisteredServices } from './register.js';
import { runAtBoundary } from './runAtBoundary.js';

/** `useMutation` options, with `mutationFn` returning an Effect instead of a promise. */
export interface UseEffectMutationOptions<A, TVariables = void, TOnMutateResult = unknown>
  extends Omit<UseMutationOptions<A, EffectHookError, TVariables, TOnMutateResult>, 'mutationFn'> {
  /** The use case to run for `variables`. It may need only the registered `AppServices`. */
  readonly mutationFn: (variables: TVariables) => Effect.Effect<A, RegisteredError, RegisteredServices>;
}

/**
 * `useMutation` for an Effect. Failures reach `error` and `onError` as an app error, a defect as
 * an `UnexpectedError`, and each is logged once through `Logger`.
 *
 * @example
 * ```ts
 * const rename = useEffectMutation({ mutationFn: (name: string) => renameTrip(id, name) });
 * ```
 */
export function useEffectMutation<A, TVariables = void, TOnMutateResult = unknown>(
  options: UseEffectMutationOptions<A, TVariables, TOnMutateResult>,
): UseMutationResult<A, EffectHookError, TVariables, TOnMutateResult> {
  const runtime = useAppRuntime();
  const { mutationFn, ...rest } = options;
  return useMutation<A, EffectHookError, TVariables, TOnMutateResult>({
    ...rest,
    mutationFn: variables => runAtBoundary(runtime, mutationFn(variables), { mutationKey: rest.mutationKey }),
  });
}
