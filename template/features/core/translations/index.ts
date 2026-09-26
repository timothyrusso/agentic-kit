import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export type { Catalog, Language, MessageKey } from '@/features/core/translations/catalog/types';
export { tr, useT } from '@/features/core/translations/hooks/useT';
export { useLanguageStore } from '@/features/core/translations/state/languageStore';
