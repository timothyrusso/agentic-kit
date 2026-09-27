import { Stack } from 'expo-router';
import { FlatList, View } from 'react-native';
import { Button, Screen, Spinner, Text, TextField, useStyles } from '@/features/core/design-system';
import type { Item } from '@/features/items/domain/entities/Item';
import { ItemRow } from '@/features/items/ui/components/ItemRow/ItemRow';
import { useItemListPageLogic } from '@/features/items/ui/pages/ItemListPage/ItemListPage.logic';
import { createStyles } from '@/features/items/ui/pages/ItemListPage/ItemListPage.style';

const keyOf = (item: Item) => String(item.id);

export function ItemListPage() {
  const { state, derived, effects } = useItemListPageLogic();
  const styles = useStyles(createStyles);
  return (
    <Screen>
      <Stack.Screen options={{ title: derived.title }} />
      <View style={styles.form}>
        <TextField
          onChangeText={effects.setDraft}
          onSubmit={effects.submit}
          placeholder={derived.placeholder}
          value={state.draft}
        />
        <Button disabled={state.isSaving} label={derived.addLabel} onPress={effects.submit} />
      </View>
      {derived.errorMessage ? (
        <View style={styles.message}>
          <Text variant="danger">{derived.errorMessage}</Text>
        </View>
      ) : null}
      {state.isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={state.items}
          keyExtractor={keyOf}
          ListEmptyComponent={<Text variant="muted">{derived.emptyLabel}</Text>}
          renderItem={({ item }) => <ItemRow item={item} onRemove={effects.remove} removeLabel={derived.removeLabel} />}
        />
      )}
    </Screen>
  );
}
