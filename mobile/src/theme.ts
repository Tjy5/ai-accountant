import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#667eea',
    secondary: '#764ba2',
    error: '#f5222d',
    success: '#52c41a',
    background: '#f5f5f5',
    surface: '#ffffff',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  roundness: 8,
};

export type AppTheme = typeof theme;
