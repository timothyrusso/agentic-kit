import { View } from 'react-native';
import { spacing } from '@/features/core/design-system/tokens';

/** A route that sets its own edges. */
export default function BrokenRoute() {
  return <View style={{ paddingHorizontal: 16, marginLeft: spacing.xl }} />;
}
