import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { migrations } from '@/features/core/sqlite/data/migrations';
export { SqliteLive } from '@/features/core/sqlite/data/sqliteLive';
