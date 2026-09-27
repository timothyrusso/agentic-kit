import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/design-system';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    form: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    message: { marginBottom: theme.spacing.md },
    list: { paddingBottom: theme.spacing.xl },
  });
