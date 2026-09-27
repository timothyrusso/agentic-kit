import { type QueryKey, type UseQueryOptions, type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { Effect } from 'effect';
import { useAppRuntime } from './EffectRuntimeProvider.js';
import type { EffectHookError, RegisteredError, RegisteredServices } from './register.js';
import { runAtBoundary } from './runAtBoundary.js';

/** `useQuery` options, with `queryFn` an Effect instead of a function returning a promise. */
export interface UseEffectQueryOptions<A, TData = A, TQueryKey extends QueryKey = QueryKey>
  extends Omit<UseQueryOptions<A, EffectHookError, TData, TQueryKey>, 'queryFn'> {
  /** The use case to run. It may need only the registered `AppServices`. */
  readonly queryFn: Effect.Effect<A, RegisteredError, RegisteredServices>;
}

/**
 * `useQuery` for an Effect. The Effect runs on the app runtime; a typed failure is `error` with
 * its own `_tag`, a defect is an `UnexpectedError` with the defect as `cause`, and each failure is
 * logged once through `Logger`. Unmounting or changing the key interrupts the running fiber.
 *
 * @example
 * ```ts
 * const trip = useEffectQuery({ queryKey: ['trip', id], queryFn: getTrip(id) });
 * ```
 */
export function useEffectQuery<A, TData = A, TQueryKey extends QueryKey = QueryKey>(
  options: UseEffectQueryOptions<A, TData, TQueryKey>,
): UseQueryResult<TData, EffectHookError> {
  const runtime = useAppRuntime();
  const { queryFn: effect, ...rest } = options;
  return useQuery<A, EffectHookError, TData, TQueryKey>({
    ...rest,
    queryFn: ({ queryKey, signal }) => runAtBoundary(runtime, effect, { queryKey }, signal),
  });
}
