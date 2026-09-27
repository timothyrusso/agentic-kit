import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export { Button } from '@/features/core/design-system/components/Button/Button';
export { FatalScreen } from '@/features/core/design-system/components/FatalScreen/FatalScreen';
export { Screen } from '@/features/core/design-system/components/Screen/Screen';
export { Spinner } from '@/features/core/design-system/components/Spinner/Spinner';
export { Text, type TextVariant } from '@/features/core/design-system/components/Text/Text';
export { TextField } from '@/features/core/design-system/components/TextField/TextField';
export type { Theme } from '@/features/core/design-system/theme/theme';
export { useStyles } from '@/features/core/design-system/theme/useStyles';
export { useTheme } from '@/features/core/design-system/theme/useTheme';
export { palette, radius, screenGutter, spacing } from '@/features/core/design-system/tokens';
