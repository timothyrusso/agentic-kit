import { act, renderHook, waitFor } from '@testing-library/react-native';
import { makeTestRuntime, makeTestWrapper } from '@/features/core/testing';
import { ItemsLive } from '@/features/items/di/layer';
import { useItemListPageLogic } from '@/features/items/ui/pages/ItemListPage/ItemListPage.logic';

const renderLogic = async () => {
  const runtime = makeTestRuntime(ItemsLive);
  const rendered = await renderHook(useItemListPageLogic, { wrapper: makeTestWrapper(runtime) });
  await waitFor(() => expect(rendered.result.current.state.isLoading).toBe(false));
  return { ...rendered, runtime };
};

describe('useItemListPageLogic', () => {
  it('starts empty with the catalog labels', async () => {
    const { result, runtime } = await renderLogic();

    expect(result.current.state.items).toEqual([]);
    expect(result.current.derived.emptyLabel).toBe('Nothing here yet. Add the first item above.');
    expect(result.current.derived.errorMessage).toBeUndefined();
    await runtime.dispose();
  });

  it('submits the draft, lists the item and clears the draft', async () => {
    const { result, runtime } = await renderLogic();

    await act(async () => result.current.effects.setDraft('Milk'));
    await act(async () => result.current.effects.submit());

    await waitFor(() => expect(result.current.state.items.map(item => item.name)).toEqual(['Milk']));
    expect(result.current.state.draft).toBe('');
    await runtime.dispose();
  });

  it('removes an item by id', async () => {
    const { result, runtime } = await renderLogic();
    await act(async () => result.current.effects.setDraft('Milk'));
    await act(async () => result.current.effects.submit());
    await waitFor(() => expect(result.current.state.items).toHaveLength(1));

    await act(async () => result.current.effects.remove(result.current.state.items[0]!.id));

    await waitFor(() => expect(result.current.state.items).toEqual([]));
    await runtime.dispose();
  });

  it('shows the catalog message for a blank name and keeps the list unchanged', async () => {
    const { result, runtime } = await renderLogic();

    await act(async () => result.current.effects.submit());

    await waitFor(() => expect(result.current.derived.errorMessage).toBe('Give the item a name.'));
    expect(result.current.state.items).toEqual([]);
    await runtime.dispose();
  });
});
