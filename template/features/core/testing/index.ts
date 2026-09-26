import type { FeatureTier } from '@timothyrusso/arch-rules';

/**
 * Shared test Layers and helpers. Import only from tests: it loads `node:sqlite`, which Metro
 * cannot bundle.
 */
export const FEATURE_TIER: FeatureTier = 0;

export { makeSqliteTestLayer } from '@/features/core/testing/sqliteTestLayer';
export { makeCoreTestLayer, makeTestRuntime } from '@/features/core/testing/testRuntime';
export { makeTestWrapper } from '@/features/core/testing/testWrapper';
