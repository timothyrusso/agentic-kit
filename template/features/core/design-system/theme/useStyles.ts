import type { Theme } from '@/features/core/design-system/theme/theme';
import { useTheme } from '@/features/core/design-system/theme/useTheme';

type StyleFactory<T> = (theme: Theme) => T;

const cache = new WeakMap<StyleFactory<unknown>, WeakMap<Theme, unknown>>();

/**
 * The styles `createStyles` builds for the current theme, memoised per factory and theme object:
 * every view gets the same style object until the theme changes.
 */
export function useStyles<T>(createStyles: StyleFactory<T>): T {
  const theme = useTheme();
  let byTheme = cache.get(createStyles);
  if (byTheme === undefined) {
    byTheme = new WeakMap();
    cache.set(createStyles, byTheme);
  }
  if (!byTheme.has(theme)) byTheme.set(theme, createStyles(theme));
  return byTheme.get(theme) as T;
}
