import { createSelectors, createStore } from '@/features/core/state';

interface ItemDraftState {
  readonly name: string;
  readonly setName: (name: string) => void;
  readonly clear: () => void;
}

const itemDraftStore = createStore<ItemDraftState>(set => ({
  name: '',
  setName: name => set({ name }),
  clear: () => set({ name: '' }),
}));

/** The name typed into the add form, kept while the user navigates away and back. */
export const useItemDraftStore = createSelectors(itemDraftStore);
