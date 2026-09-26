import { useCallback } from 'react';
import { useItems } from '@/features/items/facades/useItems';

/** The ViewModel of the items page. */
export const useItemsPageLogic = () => {
  const { data } = useItems();
  const select = useCallback((id: string) => id, []);
  return { state: { items: data ?? [] }, effects: { select } };
};
