import { Effect } from 'effect';
import { ManagedRuntime } from 'effect/ManagedRuntime';
import { lowStore } from '@/features/low/state/lowStore';

/**
 * effect-only-in-inner-layers (effect in a facade), facades-run-through-boundary
 * (effect/ManagedRuntime), enforce-index-boundary-features-low (low's state/) and
 * arch/no-effect-run-in-facades (runPromise).
 */
export const useHigh = () => ManagedRuntime.runPromise(Effect.succeed(lowStore.count));
