import { useEffectQuery } from '@timothyrusso/effect-core/react';
import { getItems } from '@/features/items/useCases/getItems';

/** Items from the repository. */
export const useItems = () => useEffectQuery(['items'], getItems());
