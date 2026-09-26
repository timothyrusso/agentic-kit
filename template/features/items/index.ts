import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 2;

export { ItemsLive } from '@/features/items/di/layer';
export type { Item, ItemId } from '@/features/items/domain/entities/Item';
export { useAddItem } from '@/features/items/facades/useAddItem';
export { useItems } from '@/features/items/facades/useItems';
export { useRemoveItem } from '@/features/items/facades/useRemoveItem';
