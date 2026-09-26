import type { ReactNode } from 'react';
import { View } from 'react-native';
import { createStyles } from '@/features/core/design-system/components/Screen/Screen.style';
import { useStyles } from '@/features/core/design-system/theme/useStyles';

/** A screen's root: the background and the screen gutter on both edges. */
export function Screen({ children }: { readonly children: ReactNode }) {
  const styles = useStyles(createStyles);
  return <View style={styles.screen}>{children}</View>;
}
