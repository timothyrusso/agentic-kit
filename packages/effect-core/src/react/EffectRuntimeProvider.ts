import { createContext, createElement, type ReactNode, useContext } from 'react';
import type { Logger } from '../logger/logger.js';
import type { AppRuntime } from '../runtime/makeAppRuntime.js';
import type { RegisteredServices } from './register.js';

/**
 * The runtime the hooks run through: it provides the registered services, and `Logger`, which the
 * boundary logs failures with.
 */
export type ProvidedRuntime = AppRuntime<RegisteredServices | Logger, unknown>;

const RuntimeContext = createContext<ProvidedRuntime | null>(null);

/** Props of {@link EffectRuntimeProvider}. */
export interface EffectRuntimeProviderProps {
  readonly runtime: ProvidedRuntime;
  readonly children?: ReactNode;
}

/**
 * Makes the app runtime available to `useEffectQuery` and `useEffectMutation`. Render it once,
 * inside the `QueryClientProvider`, with the runtime from `makeAppRuntime`.
 */
export function EffectRuntimeProvider({ runtime, children }: EffectRuntimeProviderProps): ReactNode {
  return createElement(RuntimeContext.Provider, { value: runtime }, children);
}

/** The runtime from the nearest {@link EffectRuntimeProvider}; throws outside one. */
export function useAppRuntime(): ProvidedRuntime {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) throw new Error('useEffectQuery and useEffectMutation need an EffectRuntimeProvider');
  return runtime;
}
