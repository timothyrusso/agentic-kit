import { ActivityIndicator } from 'react-native';
import { spacing } from '@/features/core/design-system/tokens';

/** The one spinner. */
export function Spinner() {
  return <ActivityIndicator style={{ marginHorizontal: spacing.md }} />;
}
