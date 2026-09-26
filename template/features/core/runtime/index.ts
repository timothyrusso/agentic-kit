import type { FeatureTier } from '@timothyrusso/arch-rules';

/** The composition root: Tier 5, so no feature can import it and it may import every feature. */
export const FEATURE_TIER: FeatureTier = 5;

export { type AppServices, runtime } from '@/features/core/runtime/runtime';
