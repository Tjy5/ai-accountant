import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';
import { animations } from './animations';

export const theme = {
  colors,
  spacing,
  typography,
  shadows,
  animations,
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    full: 9999,
  },
  iconSize: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
  },
  animation: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 350,
      slower: 500,
    },
  },
};

export type AppTheme = typeof theme;
export default theme;
