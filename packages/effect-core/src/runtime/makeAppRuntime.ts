import { Cause, Effect, Exit, type Fiber, type Layer, ManagedRuntime } from 'effect';

/** Options every `run*` method takes: an `AbortSignal` interrupts the fiber when it aborts. */
export interface RunOptions {
  readonly signal?: AbortSignal;
}

/**
 * The app's single runtime, built from the Layer that provides `AppServices`. `R` is what it
 * provides and `ER` how building it can fail (a `ConfigError`, for example). Running an
 * Effect that needs a service outside `R` is a compile error.
 */
export interface AppRuntime<R, ER = never> {
  /** Builds the Layer now instead of on first use, and rejects with its error if it fails. */
  readonly boot: () => Promise<void>;
  /** Runs an Effect; rejects with a `FiberFailure` carrying the cause, as `Effect.runPromise`. */
  readonly runPromise: <A, E>(effect: Effect.Effect<A, E, R>, options?: RunOptions) => Promise<A>;
  /** Runs an Effect and resolves with its `Exit`, never rejecting. */
  readonly runPromiseExit: <A, E>(
    effect: Effect.Effect<A, E, R>,
    options?: RunOptions,
  ) => Promise<Exit.Exit<A, E | ER>>;
  /** Starts an Effect on a new fiber and returns the fiber. */
  readonly runFork: <A, E>(effect: Effect.Effect<A, E, R>) => Fiber.RuntimeFiber<A, E | ER>;
  /** Releases every resource the Layer acquired. */
  readonly dispose: () => Promise<void>;
}

/**
 * The services an {@link AppRuntime} provides: `type AppServices = AppServicesOf<typeof runtime>`.
 */
export type AppServicesOf<T> = T extends AppRuntime<infer R, infer _ER> ? R : never;

/**
 * Builds the app's one runtime (a `ManagedRuntime`) from the Layer of every service. Create it
 * once, in `features/core/runtime`, and hand it to `EffectRuntimeProvider`.
 *
 * @example
 * ```ts
 * export const runtime = makeAppRuntime(Layer.mergeAll(ConsoleLogger, ConfigLive, TripsLive));
 * export type AppServices = AppServicesOf<typeof runtime>;
 * ```
 */
export function makeAppRuntime<R, ER>(layer: Layer.Layer<R, ER, never>): AppRuntime<R, ER> {
  const managed = ManagedRuntime.make(layer);
  return {
    boot: async () => {
      const exit = await managed.runPromiseExit(Effect.void);
      if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
    },
    runPromise: (effect, options) => managed.runPromise(effect, options),
    runPromiseExit: (effect, options) => managed.runPromiseExit(effect, options),
    runFork: effect => managed.runFork(effect),
    dispose: () => managed.dispose(),
  };
}
