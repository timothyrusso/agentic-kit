import { memo } from 'react';
import { Pressable, Text } from 'react-native';

interface Props {
  readonly id: string;
  readonly title: string;
  readonly onSelect: (id: string) => void;
}

/** One item. */
export const ItemRow = memo(function ItemRow({ id, title, onSelect }: Props) {
  return (
    <Pressable onPress={() => onSelect(id)}>
      <Text>{title}</Text>
    </Pressable>
  );
});
