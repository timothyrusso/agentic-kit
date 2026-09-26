import { Effect, Exit } from 'effect';
import { AppErrorBase, isAppError } from '../appError.js';
import { defineAppErrors, resolveMessageKey } from '../messageKeys.js';
import { toAppError, UnexpectedError } from '../unexpected.js';

class TripNotFound extends AppErrorBase('TripNotFound', 'errors.tripNotFound')<{ readonly tripId: string }> {}
class Offline extends AppErrorBase('Offline', 'errors.offline') {}

type AcmeError = TripNotFound | Offline | UnexpectedError;

describe('AppErrorBase', () => {
  it('declares a tagged error with its fields, messageKey and cause', () => {
    const cause = new Error('404');
    const error = new TripNotFound({ tripId: 't1', cause });
    expect(error._tag).toBe('TripNotFound');
    expect(error.tripId).toBe('t1');
    expect(error.messageKey).toBe('errors.tripNotFound');
    expect(TripNotFound.messageKey).toBe('errors.tripNotFound');
    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });

  it('takes no argument when the error has no fields', () => {
    expect(new Offline()._tag).toBe('Offline');
    expect(new Offline().cause).toBeUndefined();
  });

  it('is yieldable as a typed failure', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        return yield* new TripNotFound({ tripId: 't1' });
      }),
    );
    expect(exit).toEqual(Exit.fail(new TripNotFound({ tripId: 't1' })));
  });

  it('requires the declared fields', () => {
    // @ts-expect-error tripId is required
    expect(new TripNotFound()._tag).toBe('TripNotFound');
  });
});

describe('toAppError and isAppError', () => {
  it('wraps an unknown value in UnexpectedError with the value as cause', () => {
    const cause = new TypeError('boom');
    const error = toAppError(cause);
    expect(error).toBeInstanceOf(UnexpectedError);
    expect(error.cause).toBe(cause);
    expect(error.messageKey).toBe('errors.unexpected');
  });

  it('passes an UnexpectedError, and errors the guard knows, through unchanged', () => {
    const unexpected = new UnexpectedError({ cause: 'x' });
    expect(toAppError(unexpected)).toBe(unexpected);
    const notFound = new TripNotFound({ tripId: 't1' });
    expect(toAppError(notFound, (value): value is TripNotFound => value instanceof TripNotFound)).toBe(notFound);
    expect(toAppError(notFound)).toBeInstanceOf(UnexpectedError);
  });

  it('recognises app errors by shape', () => {
    expect(isAppError(new Offline())).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError({ _tag: 'X' })).toBe(false);
  });

  it('fits the catch callback of Effect.tryPromise', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.tryPromise({ try: () => Promise.reject(new Error('down')), catch: toAppError }),
    );
    expect(Exit.isFailure(exit) && exit.cause._tag === 'Fail' && exit.cause.error).toBeInstanceOf(UnexpectedError);
  });
});

describe('defineAppErrors', () => {
  const appErrors = defineAppErrors<AcmeError>();
  const mapper = appErrors.assertExhaustiveMessageKeys({
    TripNotFound: 'errors.tripNotFound',
    Offline: 'errors.offline',
    UnexpectedError: 'errors.unexpected',
  });

  it('returns the mapper, and resolves an error to its key', () => {
    expect(resolveMessageKey(new Offline(), mapper)).toBe('errors.offline');
    expect(resolveMessageKey(new UnexpectedError({ cause: 1 }), mapper)).toBe('errors.unexpected');
  });

  it('makes a missing or unknown tag a type error', () => {
    // @ts-expect-error Offline is missing
    appErrors.assertExhaustiveMessageKeys({ TripNotFound: 'a', UnexpectedError: 'b' });
    appErrors.assertExhaustiveMessageKeys({
      TripNotFound: 'a',
      Offline: 'b',
      UnexpectedError: 'c',
      // @ts-expect-error Stale is not in the union
      Stale: 'd',
    });
    // @ts-expect-error UnexpectedError is always required
    defineAppErrors<TripNotFound>().assertExhaustiveMessageKeys({ TripNotFound: 'a' });
  });
});
