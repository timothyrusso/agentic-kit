import { type AppServicesOf, makeAppRuntime } from '@timothyrusso/effect-core';
import { Layer } from 'effect';
import { ConfigLive } from '@/features/core/config';
import type { AppError } from '@/features/core/error';
import { LoggerLive } from '@/features/core/logger';
import { SqliteLive } from '@/features/core/sqlite';
import { ItemsLive } from '@/features/items';

const CoreLive = Layer.mergeAll(LoggerLive, SqliteLive.pipe(Layer.provideMerge(ConfigLive)));

const FeaturesLive = Layer.mergeAll(ItemsLive);

/** The app's one runtime. Only `app/_layout.tsx` imports it, to boot it and mount the provider. */
export const runtime = makeAppRuntime(FeaturesLive.pipe(Layer.provideMerge(CoreLive)));

/** Every service the runtime provides: what a facade's Effect may need. */
export type AppServices = AppServicesOf<typeof runtime>;

declare module '@timothyrusso/effect-core/react' {
  interface Register {
    services: AppServices;
    error: AppError;
  }
}
