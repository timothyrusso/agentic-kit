import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@timothyrusso/effect-core/react';
import type { ItemId } from '@/features/items/domain/entities/Item';
import { ITEMS_QUERY_KEY } from '@/features/items/facades/itemsQueryKey';
import { removeItem } from '@/features/items/useCases/removeItem';

/** Removes an item and refreshes the list, also when it was already gone. */
export const useRemoveItem = () => {
  const queryClient = useQueryClient();
  return useEffectMutation({
    mutationFn: (id: ItemId) => removeItem(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY }),
  });
};
