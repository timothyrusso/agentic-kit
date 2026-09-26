import { fireEvent, render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { makeTestRuntime, makeTestWrapper } from '@/features/core/testing';
import { ItemsLive } from '@/features/items/di/layer';
import { ItemListPage } from '@/features/items/ui/pages/ItemListPage/ItemListPage';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

describe('ItemListPage', () => {
  it('adds an item and removes it again', async () => {
    const runtime = makeTestRuntime(ItemsLive);
    await render(createElement(ItemListPage), { wrapper: makeTestWrapper(runtime) });

    expect(await screen.findByText('Nothing here yet. Add the first item above.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('New item'), 'Milk');
    await fireEvent.press(screen.getByText('Add'));
    expect(await screen.findByText('Milk')).toBeTruthy();

    await fireEvent.press(screen.getByText('Remove'));
    expect(await screen.findByText('Nothing here yet. Add the first item above.')).toBeTruthy();
    await runtime.dispose();
  });

  it('shows the catalog message for a blank name', async () => {
    const runtime = makeTestRuntime(ItemsLive);
    await render(createElement(ItemListPage), { wrapper: makeTestWrapper(runtime) });

    await fireEvent.press(await screen.findByText('Add'));
    expect(await screen.findByText('Give the item a name.')).toBeTruthy();
    await runtime.dispose();
  });
});
