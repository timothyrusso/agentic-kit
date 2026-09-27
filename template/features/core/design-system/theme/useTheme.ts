import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from '@/features/core/design-system/theme/theme';

/** The theme for the system colour scheme. The object is the same until the scheme changes. */
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? darkTheme : lightTheme);
