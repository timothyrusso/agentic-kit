import { makeAppRuntime, NoopLogger } from '@timothyrusso/effect-core';
import { Layer } from 'effect';
import { AppConfig } from '@/features/core/config';
import { makeSqliteTestLayer } from '@/features/core/testing/sqliteTestLayer';

/** What the core provides in tests: a silent `Logger`, a fixed config and a migrated database. */
export const makeCoreTestLayer = () =>
  Layer.mergeAll(NoopLogger, AppConfig.layerOf({ databaseName: ':memory:' }), makeSqliteTestLayer());

type CoreTestServices = Layer.Layer.Success<ReturnType<typeof makeCoreTestLayer>>;

/**
 * A runtime for facade and page tests: the given feature Layers over the core test Layers. Build
 * one per test, so no two tests share a database.
 */
export const makeTestRuntime = <R, E>(features: Layer.Layer<R, E, CoreTestServices>) =>
  makeAppRuntime(features.pipe(Layer.provideMerge(makeCoreTestLayer())));
