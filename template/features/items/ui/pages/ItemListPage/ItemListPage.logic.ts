import { useCallback } from 'react';
import { useAppErrorMessage } from '@/features/core/error';
import { useT } from '@/features/core/translations';
import type { ItemId } from '@/features/items/domain/entities/Item';
import { useAddItem } from '@/features/items/facades/useAddItem';
import { useItems } from '@/features/items/facades/useItems';
import { useRemoveItem } from '@/features/items/facades/useRemoveItem';
import { useItemDraftStore } from '@/features/items/state/itemDraftStore';

/** The ViewModel of the items page: the list, the add form and the remove action. */
export const useItemListPageLogic = () => {
  const { t } = useT();
  const items = useItems();
  const add = useAddItem();
  const remove = useRemoveItem();
  const draft = useItemDraftStore.use.name();
  const setDraft = useItemDraftStore.use.setName();
  const clearDraft = useItemDraftStore.use.clear();
  const errorMessage = useAppErrorMessage(add.error ?? remove.error ?? items.error);

  const addMutate = add.mutate;
  const submit = useCallback(() => addMutate(draft, { onSuccess: clearDraft }), [addMutate, draft, clearDraft]);
  const removeMutate = remove.mutate;
  const removeById = useCallback((id: ItemId) => removeMutate(id), [removeMutate]);

  return {
    state: { items: items.data ?? [], draft, isLoading: items.isPending, isSaving: add.isPending },
    derived: {
      title: t('items.title'),
      placeholder: t('items.placeholder'),
      addLabel: t('items.add'),
      removeLabel: t('items.remove'),
      emptyLabel: t('items.empty'),
      errorMessage,
    },
    effects: { setDraft, submit, remove: removeById },
  };
};
