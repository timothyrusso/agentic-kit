import type { ReactNode } from 'react';
import { Text as NativeText } from 'react-native';
import { createStyles } from '@/features/core/design-system/components/Text/Text.style';
import { useStyles } from '@/features/core/design-system/theme/useStyles';

export type TextVariant = 'body' | 'title' | 'muted' | 'danger';

interface TextProps {
  readonly variant?: TextVariant;
  readonly children: ReactNode;
}

/** Text in one of the type variants; the only place a font size is set. */
export function Text({ variant = 'body', children }: TextProps) {
  const styles = useStyles(createStyles);
  return <NativeText style={styles[variant]}>{children}</NativeText>;
}
