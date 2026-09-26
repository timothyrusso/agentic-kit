import { useEffectQuery } from '@timothyrusso/effect-core/react';
import { ITEMS_QUERY_KEY } from '@/features/items/facades/itemsQueryKey';
import { listItems } from '@/features/items/useCases/listItems';

/** Every item, newest first. */
export const useItems = () => useEffectQuery({ queryKey: ITEMS_QUERY_KEY, queryFn: listItems });
