import { Effect } from 'effect';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { spacing } from '@/features/core/design-system/tokens';
import { useBrokenPageLogic } from './BrokenPage.logic';

enum Mode {
  List,
  Grid,
}

// Renders the broken page
export function BrokenPage() {
  const vm = useBrokenPageLogic();
  const [mode] = useState(Mode.List);
  const onPress = () => Effect.succeed(mode);
  return (
    <View style={{ paddingHorizontal: 16 }}>
      // the header went away
      <ActivityIndicator />
      <FlatList
        data={vm.items}
        renderItem={({ item }) => <Row id={item} onPress={onPress} onLongPress={() => item} />}
      />
      <Text style={{ marginHorizontal: spacing.xl }}>{String(new Error('x') as Error)}</Text>
    </View>
  );
}
