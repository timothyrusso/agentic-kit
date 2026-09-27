/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { Effect } from 'effect';
import { defineAppErrors } from '../../errors/messageKeys.js';
import { UnexpectedError } from '../../errors/unexpected.js';
import { type EffectHookError, useEffectMutation, useEffectQuery, useErrorMessage } from '../index.js';
import { type AcmeError, makeAcmeRuntime, makeWrapper, Payments, TripNotFound, Trips } from './fixtures.js';

const tripName = (id: string) => Effect.flatMap(Trips, trips => trips.name(id));

function setup() {
  const { logs, runtime } = makeAcmeRuntime();
  const { client, wrapper } = makeWrapper(runtime);
  return { client, logs, runtime, wrapper };
}

describe('useEffectQuery', () => {
  it('resolves with the value of the Effect, run on the app runtime', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useEffectQuery({ queryKey: ['trip', 't1'], queryFn: tripName('t1') }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toBe('trip t1'));
  });

  it('exposes a typed failure as error with its _tag, logged once as a warning', async () => {
    const { logs, wrapper } = setup();
    const { result } = renderHook(
      () => useEffectQuery({ queryKey: ['trip', 'gone'], queryFn: Effect.fail(new TripNotFound({ tripId: 'gone' })) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    const error: EffectHookError | null = result.current.error;
    expect(error?._tag).toBe('TripNotFound');
    expect(error).toBeInstanceOf(TripNotFound);
    expect(logs.entries).toEqual([
      { level: 'warn', message: 'TripNotFound', error: undefined, context: { queryKey: ['trip', 'gone'], error } },
    ]);
  });

  it('turns a thrown defect into UnexpectedError with the cause, logged exactly once', async () => {
    const { logs, wrapper } = setup();
    const defect = new TypeError('undefined is not a function');
    const { result } = renderHook(
      () =>
        useEffectQuery({
          queryKey: ['trip', 'broken'],
          queryFn: Effect.sync((): string => {
            throw defect;
          }),
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(UnexpectedError);
    expect(result.current.error?._tag).toBe('UnexpectedError');
    expect(result.current.error?.cause).toBe(defect);
    expect(logs.entries).toHaveLength(1);
    expect(logs.entries[0]).toMatchObject({ level: 'error', message: 'UnexpectedError', error: result.current.error });
    expect(logs.entries[0]?.context).toEqual({ queryKey: ['trip', 'broken'] });
  });

  it('interrupts the fiber when the component unmounts', async () => {
    const { wrapper } = setup();
    const interrupted = jest.fn();
    const started = jest.fn();
    const pending = Effect.sync(started).pipe(
      Effect.zipRight(Effect.never),
      Effect.onInterrupt(() => Effect.sync(interrupted)),
    );
    const { unmount } = renderHook(() => useEffectQuery({ queryKey: ['slow'], queryFn: pending }), { wrapper });
    await waitFor(() => expect(started).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(interrupted).toHaveBeenCalledTimes(1));
  });

  it('interrupts the fiber of the previous key when the key changes', async () => {
    const { wrapper } = setup();
    const interrupted: string[] = [];
    const started: string[] = [];
    const slow = (id: string) =>
      Effect.sync(() => void started.push(id)).pipe(
        Effect.zipRight(Effect.never),
        Effect.onInterrupt(() => Effect.sync(() => void interrupted.push(id))),
      );
    const { rerender } = renderHook(({ id }) => useEffectQuery({ queryKey: ['slow', id], queryFn: slow(id) }), {
      wrapper,
      initialProps: { id: 'a' },
    });
    await waitFor(() => expect(started).toEqual(['a']));
    rerender({ id: 'b' });
    await waitFor(() => expect(interrupted).toEqual(['a']));
    expect(started).toEqual(['a', 'b']);
  });

  it('accepts only Effects the registered runtime can run', () => {
    const charge = Effect.flatMap(Payments, payments => payments.charge);
    const options = {
      queryKey: ['charge'],
      // @ts-expect-error Payments is not in the registered AppServices
      queryFn: charge,
    } satisfies Parameters<typeof useEffectQuery>[0];
    expect(options.queryKey).toEqual(['charge']);
    const untyped = {
      queryKey: ['untyped'],
      // @ts-expect-error a failure outside the registered AppError union
      queryFn: Effect.fail(new Error('plain')),
    } satisfies Parameters<typeof useEffectQuery>[0];
    expect(untyped.queryKey).toEqual(['untyped']);
  });

  it('throws outside an EffectRuntimeProvider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useEffectQuery({ queryKey: ['x'], queryFn: tripName('x') }))).toThrow(
      /EffectRuntimeProvider/,
    );
    jest.restoreAllMocks();
  });
});

describe('useEffectMutation', () => {
  it('resolves with the value and hands a failure to onError as an app error, logged once', async () => {
    const { logs, wrapper } = setup();
    const onError = jest.fn<void, [EffectHookError]>();
    const { result } = renderHook(
      () =>
        useEffectMutation({
          mutationKey: ['rename'],
          mutationFn: (id: string) => (id === 'gone' ? Effect.fail(new TripNotFound({ tripId: id })) : tripName(id)),
          onError,
        }),
      { wrapper },
    );
    await act(async () => {
      await expect(result.current.mutateAsync('t2')).resolves.toBe('trip t2');
    });
    await act(async () => {
      await expect(result.current.mutateAsync('gone')).rejects.toBeInstanceOf(TripNotFound);
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]._tag).toBe('TripNotFound');
    expect(logs.entries).toHaveLength(1);
    expect(logs.entries[0]?.context).toMatchObject({ mutationKey: ['rename'] });
  });

  it('turns a defect into UnexpectedError', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useEffectMutation({ mutationFn: () => Effect.die('boom') }), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toMatchObject({ _tag: 'UnexpectedError', cause: 'boom' });
    });
  });
});

describe('useErrorMessage', () => {
  const messages = defineAppErrors<AcmeError>().assertExhaustiveMessageKeys({
    TripNotFound: 'errors.tripNotFound',
    UnexpectedError: 'errors.unexpected',
  });
  const t = (key: 'errors.tripNotFound' | 'errors.unexpected') => `translated ${key}`;

  it('translates the key the mapper gives the error, and is undefined without an error', () => {
    const { result, rerender } = renderHook<string | undefined, { error: AcmeError | null }>(
      ({ error }) => useErrorMessage(error, messages, t),
      { initialProps: { error: new TripNotFound({ tripId: 't1' }) } },
    );
    expect(result.current).toBe('translated errors.tripNotFound');
    rerender({ error: null });
    expect(result.current).toBeUndefined();
  });
});
