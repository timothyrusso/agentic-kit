import { Cause, Effect, Exit, Option } from 'effect';
import { UnexpectedError } from '../errors/unexpected.js';
import { type LogContext, Logger } from '../logger/logger.js';
import type { ProvidedRuntime } from './EffectRuntimeProvider.js';
import type { RegisteredError, RegisteredServices } from './register.js';

/**
 * Runs a hook's Effect on the app runtime and settles the promise TanStack Query expects. A defect
 * becomes an `UnexpectedError` with the defect as `cause`. Each failure is logged once: an
 * `UnexpectedError` through `Logger.error`, a typed failure through `Logger.warn` with its tag.
 * The promise rejects with the error itself, not a `FiberFailure`. Aborting `signal` interrupts
 * the fiber.
 */
export async function runAtBoundary<A>(
  runtime: ProvidedRuntime,
  effect: Effect.Effect<A, RegisteredError, RegisteredServices>,
  context: LogContext,
  signal?: AbortSignal,
): Promise<A> {
  const program = effect.pipe(
    Effect.catchAllDefect(defect => Effect.fail(new UnexpectedError({ cause: defect }))),
    Effect.tapError(error =>
      Effect.flatMap(Logger, logger =>
        error instanceof UnexpectedError
          ? logger.error(error, context)
          : logger.warn(error._tag, { ...context, error }),
      ),
    ),
  );
  const exit = await runtime.runPromiseExit(program, signal === undefined ? {} : { signal });
  if (Exit.isSuccess(exit)) return exit.value;
  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) throw failure.value;
  throw Cause.squash(exit.cause);
}
