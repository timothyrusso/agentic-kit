import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/design-system/theme/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.lg,
    },
  });
