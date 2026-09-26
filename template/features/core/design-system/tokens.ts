/** The spacing scale. Inside a component use a step; a screen edge is always `screenGutter`. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** The one horizontal screen edge. `arch/no-literal-gutter` keeps every other value out. */
export const screenGutter = 20;

export const radius = {
  sm: 6,
  md: 10,
} as const;

export const palette = {
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F2F2F7',
  gray300: '#C7C7CC',
  gray600: '#636366',
  gray900: '#1C1C1E',
  blue: '#0A84FF',
  red: '#FF453A',
} as const;
