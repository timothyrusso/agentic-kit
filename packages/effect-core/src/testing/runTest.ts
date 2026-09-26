import { Effect, type Layer, TestContext } from 'effect';

/** An Effect, or a function building one per run (so each test starts from fresh state). */
export type EffectOrThunk<A, E, R> = Effect.Effect<A, E, R> | (() => Effect.Effect<A, E, R>);

type JestIt = (name: string, fn: () => Promise<void>, timeout?: number) => void;

function build<A, E, R>(effect: EffectOrThunk<A, E, R>): Effect.Effect<A, E, R> {
  return Effect.isEffect(effect) ? effect : Effect.suspend(effect);
}

/**
 * Runs `effect` with `layer` and the Effect test services (`TestClock` included: time stands
 * still until the test moves it with `advanceClock`). Resolves with the value; rejects with the
 * failure, as `Effect.runPromise`. The Layer is built for this run and released after it.
 */
export function runTest<A, E>(effect: EffectOrThunk<A, E, never>): Promise<A>;
export function runTest<A, E, R, LE>(effect: EffectOrThunk<A, E, R>, layer: Layer.Layer<R, LE, never>): Promise<A>;
export function runTest<A, E, R, LE>(effect: EffectOrThunk<A, E, R>, layer?: Layer.Layer<R, LE, never>): Promise<A> {
  const program = layer === undefined ? build(effect) : Effect.provide(build(effect), layer);
  // NOTE: without a layer R is never (the first overload), so the provide below leaves nothing open.
  return Effect.runPromise(Effect.provide(program as Effect.Effect<A, E | LE>, TestContext.TestContext));
}

/**
 * A jest test whose body is an Effect, run with {@link runTest}. The test fails with the
 * Effect's failure or defect.
 *
 * @example
 * ```ts
 * itEffect('saves a trip', Effect.gen(function* () {
 *   yield* saveTrip(trip);
 *   expect(yield* listTrips).toEqual([trip]);
 * }), TripsTestLayer);
 * ```
 */
export function itEffect<A, E>(name: string, effect: EffectOrThunk<A, E, never>): void;
export function itEffect<A, E, R, LE>(
  name: string,
  effect: EffectOrThunk<A, E, R>,
  layer: Layer.Layer<R, LE, never>,
): void;
export function itEffect<A, E, R, LE>(
  name: string,
  effect: EffectOrThunk<A, E, R>,
  layer?: Layer.Layer<R, LE, never>,
): void {
  const it = (globalThis as { it?: JestIt }).it;
  if (it === undefined) throw new Error('itEffect runs inside jest, where `it` is a global');
  it(name, async () => {
    await (layer === undefined ? runTest(effect as EffectOrThunk<A, E, never>) : runTest(effect, layer));
  });
}
