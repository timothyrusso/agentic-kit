import { memo } from 'react';
import { Pressable, Text } from 'react-native';
import { createStyles } from '@/features/core/design-system/components/Button/Button.style';
import { useStyles } from '@/features/core/design-system/theme/useStyles';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'filled' | 'plain';
  readonly disabled?: boolean;
}

/** A pressable label: `filled` for the main action of a screen, `plain` inside rows. */
export const Button = memo(function Button({ label, onPress, variant = 'filled', disabled = false }: ButtonProps) {
  const styles = useStyles(createStyles);
  const filled = variant === 'filled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[filled ? styles.button : styles.plain, disabled && styles.disabled]}
    >
      <Text style={filled ? styles.label : styles.plainLabel}>{label}</Text>
    </Pressable>
  );
});
