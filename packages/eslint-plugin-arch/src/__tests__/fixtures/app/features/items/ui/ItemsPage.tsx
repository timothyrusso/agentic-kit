import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner } from '@/features/core/design-system/Spinner';
import { useTheme } from '@/features/core/design-system/theme';
import { ItemRow } from '@/features/items/ui/ItemRow';
import { useItemsPageLogic } from '@/features/items/ui/ItemsPage.logic';

interface Item {
  readonly id: string;
  readonly title: string;
}

const keyExtractor = (item: Item) => item.id;

/** The items page. */
export function ItemsPage() {
  const { state, effects } = useItemsPageLogic();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (state.items.length === 0) return <Spinner />;
  return (
    <FlashList
      data={state.items}
      keyExtractor={keyExtractor}
      contentContainerStyle={{ paddingBottom: insets.bottom, backgroundColor: theme.background }}
      renderItem={({ item }) => <ItemRow id={item.id} title={item.title} onSelect={effects.select} />}
    />
  );
}
