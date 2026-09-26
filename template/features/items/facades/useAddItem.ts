import { useQueryClient } from '@tanstack/react-query';
import { useEffectMutation } from '@timothyrusso/effect-core/react';
import { ITEMS_QUERY_KEY } from '@/features/items/facades/itemsQueryKey';
import { addItem } from '@/features/items/useCases/addItem';

/** Adds an item and refreshes the list. The error surfaces inline, next to the form. */
export const useAddItem = () => {
  const queryClient = useQueryClient();
  return useEffectMutation({
    mutationFn: (name: string) => addItem(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_QUERY_KEY }),
  });
};
