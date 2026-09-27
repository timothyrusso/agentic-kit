import { act, renderHook, waitFor } from '@testing-library/react-native';
import { makeTestRuntime, makeTestWrapper } from '@/features/core/testing';
import { ItemsLive } from '@/features/items/di/layer';
import { useAddItem } from '@/features/items/facades/useAddItem';
import { useItems } from '@/features/items/facades/useItems';

const useItemsAndAdd = () => ({ items: useItems(), add: useAddItem() });

describe('items facades', () => {
  it('lists what useAddItem added, through the runtime and a real database', async () => {
    const runtime = makeTestRuntime(ItemsLive);
    const { result } = await renderHook(useItemsAndAdd, { wrapper: makeTestWrapper(runtime) });
    await waitFor(() => expect(result.current.items.data).toEqual([]));

    await act(() => result.current.add.mutateAsync('Milk'));

    await waitFor(() => expect(result.current.items.data?.map(item => item.name)).toEqual(['Milk']));
    await runtime.dispose();
  });

  it('reports a blank name as ItemNameEmpty', async () => {
    const runtime = makeTestRuntime(ItemsLive);
    const { result } = await renderHook(useAddItem, { wrapper: makeTestWrapper(runtime) });

    await act(async () => {
      await result.current.mutateAsync(' ').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.error?._tag).toBe('ItemNameEmpty'));
    await runtime.dispose();
  });
});
