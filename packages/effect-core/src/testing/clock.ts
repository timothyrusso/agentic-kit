import { type Duration, type Effect, TestClock } from 'effect';

/**
 * Moves the `TestClock` that {@link runTest} and {@link itEffect} install forward by `duration`,
 * running every sleep and schedule that falls due. Fork the Effect that waits first, then advance.
 *
 * @example
 * ```ts
 * itEffect('expires the cache after an hour', Effect.gen(function* () {
 *   const fiber = yield* Effect.fork(expireAfter(Duration.hours(1)));
 *   yield* advanceClock(Duration.hours(1));
 *   expect(yield* Fiber.join(fiber)).toBe('expired');
 * }));
 * ```
 */
export function advanceClock(duration: Duration.DurationInput): Effect.Effect<void> {
  return TestClock.adjust(duration);
}
