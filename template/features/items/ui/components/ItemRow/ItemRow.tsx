import { memo, useCallback } from 'react';
import { View } from 'react-native';
import { Button, Text, useStyles } from '@/features/core/design-system';
import type { Item, ItemId } from '@/features/items/domain/entities/Item';
import { createStyles } from '@/features/items/ui/components/ItemRow/ItemRow.style';

interface ItemRowProps {
  readonly item: Item;
  readonly removeLabel: string;
  readonly onRemove: (id: ItemId) => void;
}

/** One item: its name and a remove button. Memoised, so it takes `onRemove(id)` from the ViewModel. */
export const ItemRow = memo(function ItemRow({ item, removeLabel, onRemove }: ItemRowProps) {
  const styles = useStyles(createStyles);
  const remove = useCallback(() => onRemove(item.id), [onRemove, item.id]);
  return (
    <View style={styles.row}>
      <Text>{item.name}</Text>
      <Button label={removeLabel} onPress={remove} variant="plain" />
    </View>
  );
});
