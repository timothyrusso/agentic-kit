import { runtime } from '@/features/core/runtime';

/** A facade that runs its own Effect. */
export const useBroken = () => runtime.runPromise(load());
