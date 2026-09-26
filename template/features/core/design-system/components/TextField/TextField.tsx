import { TextInput } from 'react-native';
import { createStyles } from '@/features/core/design-system/components/TextField/TextField.style';
import { useStyles } from '@/features/core/design-system/theme/useStyles';
import { useTheme } from '@/features/core/design-system/theme/useTheme';

interface TextFieldProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder: string;
  readonly onSubmit?: () => void;
}

/** A single-line text input. */
export function TextField({ value, onChangeText, placeholder, onSubmit }: TextFieldProps) {
  const styles = useStyles(createStyles);
  const theme = useTheme();
  return (
    <TextInput
      accessibilityLabel={placeholder}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      returnKeyType="done"
      style={styles.input}
      value={value}
    />
  );
}
