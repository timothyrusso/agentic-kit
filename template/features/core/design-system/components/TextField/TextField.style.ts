import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/design-system/theme/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    input: {
      flex: 1,
      fontSize: 17,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
  });
