import { ActivityIndicator } from 'react-native';
import { useTheme } from '@/features/core/design-system/theme/useTheme';

/** The app's one spinner (`lint.singleSpinner` forbids `ActivityIndicator` everywhere else). */
export function Spinner() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.colors.primary} />;
}
