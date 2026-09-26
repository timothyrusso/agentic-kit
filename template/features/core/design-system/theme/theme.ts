import { palette, radius, screenGutter, spacing } from '@/features/core/design-system/tokens';

/** Everything a style reads: colours for the current scheme, the spacing scale and the gutter. */
export interface Theme {
  readonly colors: {
    readonly background: string;
    readonly surface: string;
    readonly text: string;
    readonly textMuted: string;
    readonly border: string;
    readonly primary: string;
    readonly onPrimary: string;
    readonly danger: string;
  };
  readonly spacing: typeof spacing;
  readonly gutter: typeof screenGutter;
  readonly radius: typeof radius;
}

export const lightTheme: Theme = {
  colors: {
    background: palette.white,
    surface: palette.gray100,
    text: palette.black,
    textMuted: palette.gray600,
    border: palette.gray300,
    primary: palette.blue,
    onPrimary: palette.white,
    danger: palette.red,
  },
  spacing,
  gutter: screenGutter,
  radius,
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    background: palette.black,
    surface: palette.gray900,
    text: palette.white,
    textMuted: palette.gray300,
    border: palette.gray600,
    primary: palette.blue,
    onPrimary: palette.white,
    danger: palette.red,
  },
};
