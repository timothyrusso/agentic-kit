import { resetAllStores } from '@/features/core/state';
import { useItemDraftStore } from '@/features/items/state/itemDraftStore';

afterEach(resetAllStores);

describe('itemDraftStore', () => {
  it('holds the typed name until it is cleared', () => {
    useItemDraftStore.getState().setName('Milk');
    expect(useItemDraftStore.getState().name).toBe('Milk');
    useItemDraftStore.getState().clear();
    expect(useItemDraftStore.getState().name).toBe('');
  });
});
