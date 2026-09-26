import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Context, Effect, Layer } from 'effect';
import { createElement, type ReactNode } from 'react';
import { AppErrorBase } from '../../errors/appError.js';
import type { UnexpectedError } from '../../errors/unexpected.js';
import { type AppServicesOf, makeAppRuntime } from '../../runtime/makeAppRuntime.js';
import { collectLogs } from '../../testing/collectLogs.js';
import { EffectRuntimeProvider } from '../EffectRuntimeProvider.js';

/** A service the test runtime provides. */
export class Trips extends Context.Tag('acme/Trips')<
  Trips,
  { readonly name: (id: string) => Effect.Effect<string> }
>() {}

/** A service the test runtime does not provide. */
export class Payments extends Context.Tag('acme/Payments')<Payments, { readonly charge: Effect.Effect<void> }>() {}

/** A typed failure of the acme app. */
export class TripNotFound extends AppErrorBase('TripNotFound', 'errors.tripNotFound')<{ readonly tripId: string }> {}

/** The acme app's closed error union. */
export type AcmeError = TripNotFound | UnexpectedError;

/** Builds the acme runtime with a collecting logger, as an app's `core/runtime` would. */
export function makeAcmeRuntime() {
  const logs = collectLogs();
  const TripsTest = Layer.succeed(Trips, { name: (id: string) => Effect.succeed(`trip ${id}`) });
  const runtime = makeAppRuntime(Layer.merge(logs.layer, TripsTest));
  return { logs, runtime };
}

/** The services of the acme runtime. */
export type AcmeServices = AppServicesOf<ReturnType<typeof makeAcmeRuntime>['runtime']>;

declare module '../index.js' {
  interface Register {
    services: AcmeServices;
    error: AcmeError;
  }
}

/** The providers an app renders at its root, around each hook under test. */
export function makeWrapper(runtime: ReturnType<typeof makeAcmeRuntime>['runtime']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, createElement(EffectRuntimeProvider, { runtime }, children));
  return { client, wrapper };
}
