import { StyleSheet } from 'react-native';
import type { Theme } from '@/features/core/design-system/theme/theme';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    body: { fontSize: 17, color: theme.colors.text },
    title: { fontSize: 22, fontWeight: '600', color: theme.colors.text },
    muted: { fontSize: 15, color: theme.colors.textMuted },
    danger: { fontSize: 15, color: theme.colors.danger },
  });
