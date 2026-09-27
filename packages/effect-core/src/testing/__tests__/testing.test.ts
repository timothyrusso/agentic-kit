import { Clock, Context, Duration, Effect, Fiber, Layer } from 'effect';
import { Logger } from '../../logger/logger.js';
import { advanceClock } from '../clock.js';
import { collectLogs } from '../collectLogs.js';
import { itEffect, runTest } from '../runTest.js';

class Counter extends Context.Tag('acme/Counter')<Counter, { readonly next: Effect.Effect<number> }>() {}

const CounterLive = Layer.sync(Counter, () => {
  let n = 0;
  return { next: Effect.sync(() => ++n) };
});

describe('itEffect and runTest', () => {
  itEffect(
    'runs an Effect body with its Layer',
    Effect.gen(function* () {
      const counter = yield* Counter;
      expect(yield* counter.next).toBe(1);
      expect(yield* counter.next).toBe(2);
    }),
    CounterLive,
  );

  itEffect(
    'builds the Layer again for every run',
    Effect.gen(function* () {
      expect(yield* Effect.flatMap(Counter, counter => counter.next)).toBe(1);
    }),
    CounterLive,
  );

  itEffect('runs without a Layer when the Effect needs nothing', () => Effect.succeed(1));

  it('resolves with the value and rejects with the failure', async () => {
    await expect(runTest(Effect.succeed('ok'))).resolves.toBe('ok');
    await expect(runTest(Effect.fail('nope'))).rejects.toThrow('nope');
  });
});

describe('advanceClock', () => {
  itEffect(
    'moves the TestClock, so sleeps finish without waiting',
    Effect.gen(function* () {
      expect(yield* Clock.currentTimeMillis).toBe(0);
      const fiber = yield* Effect.fork(Effect.as(Effect.sleep(Duration.hours(1)), 'woke'));
      yield* advanceClock(Duration.minutes(59));
      expect(fiber.unsafePoll()).toBeNull();
      yield* advanceClock(Duration.minutes(1));
      expect(yield* Fiber.join(fiber)).toBe('woke');
      expect(yield* Clock.currentTimeMillis).toBe(3_600_000);
    }),
  );
});

describe('collectLogs', () => {
  it('records every call with its level, message and context, and clears', async () => {
    const logs = collectLogs();
    await runTest(
      Effect.gen(function* () {
        const logger = yield* Logger;
        yield* logger.info('started', { id: 1 });
        yield* logger.error(new Error('boom'));
      }),
      logs.layer,
    );
    expect(logs.entries).toEqual([
      { level: 'info', message: 'started', error: undefined, context: { id: 1 } },
      { level: 'error', message: 'Error: boom', error: new Error('boom'), context: {} },
    ]);
    logs.clear();
    expect(logs.entries).toEqual([]);
  });
});
