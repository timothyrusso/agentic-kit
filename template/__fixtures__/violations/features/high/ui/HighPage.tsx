import { Effect } from 'effect';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { HIGH_LIMIT } from '@/features/high/domain/limits';
import { useHigh } from '@/features/high/facades/useHigh';
import { useHighPageLogic } from '@/features/high/ui/HighPage.logic';
import { lowValue } from '@/features/low';
import { helper } from './helper';

enum Mode {
  List,
  Grid,
}

// a plain comment: arch/no-inline-comments
export function HighPage() {
  const vm = useHighPageLogic();
  const [mode] = useState(Mode.List);
  const run = () => Effect.succeed(useHigh);
  return (
    <View>
      <Text>// arch/no-jsx-comment-text</Text>
      <ActivityIndicator />
      <FlatList data={vm.items} renderItem={({ item }) => <Row id={item} onPress={() => run()} />} />
      <Text>{String(new Error(String(mode + HIGH_LIMIT + lowValue + helper(1))) as Error)}</Text>
    </View>
  );
}
