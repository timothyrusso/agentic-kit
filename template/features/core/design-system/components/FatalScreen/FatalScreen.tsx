import { View } from 'react-native';
import { Button } from '@/features/core/design-system/components/Button/Button';
import { createStyles } from '@/features/core/design-system/components/FatalScreen/FatalScreen.style';
import { Text } from '@/features/core/design-system/components/Text/Text';
import { useStyles } from '@/features/core/design-system/theme/useStyles';

interface FatalScreenProps {
  readonly title: string;
  readonly message: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

/** The whole-screen failure: the runtime did not boot, or the root error boundary caught a crash. */
export function FatalScreen({ title, message, action }: FatalScreenProps) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.screen}>
      <Text variant="title">{title}</Text>
      <Text variant="muted">{message}</Text>
      {action ? <Button label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
