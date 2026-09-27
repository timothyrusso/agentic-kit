import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/design-system/theme/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    plain: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    disabled: { opacity: 0.5 },
    label: { color: theme.colors.onPrimary, fontSize: 17, fontWeight: '600' },
    plainLabel: { color: theme.colors.primary, fontSize: 15 },
  });
