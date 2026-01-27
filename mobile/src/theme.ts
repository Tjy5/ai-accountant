import { MD3DarkTheme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

// ============================================
// Modern Finance Theme - Clean Light
// ============================================

const wealthColors = {
  background: '#F8F9FB',     // Very subtle cool gray/white
  surface: '#FFFFFF',        // Pure white
  surfaceHighlight: '#EFF1F5', // Light gray for interactions
  primary: '#2563EB',        // Royal Blue (Trustworthy, Premium)
  primaryLight: '#60A5FA',   // Light Blue
  primaryDark: '#1E40AF',    // Deep Blue
  primaryGlow: 'rgba(37, 99, 235, 0.15)',
  textPrimary: '#1E293B',    // Slate 800 (Soft Black)
  textSecondary: '#64748B',  // Slate 500
  textMuted: '#94A3B8',      // Slate 400
  error: '#EF4444',          // Standard Red
  success: '#10B981',        // Emerald Green
  warning: '#F59E0B',        // Amber
};

// Create combined Navigation + Paper theme
const { DarkTheme: CombinedDarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

const DarkThemeColors = CombinedDarkTheme?.colors || NavigationDarkTheme.colors;

// Wealth Theme - extends MD3DarkTheme with custom colors
export const WealthTheme = {
  ...MD3DarkTheme,
  ...CombinedDarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...DarkThemeColors,

    // Material Design 3 Semantic Mapping
    primary: wealthColors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: wealthColors.surfaceHighlight,
    onPrimaryContainer: wealthColors.primaryLight,

    background: wealthColors.background,
    onBackground: wealthColors.textPrimary,

    surface: wealthColors.surface,
    onSurface: wealthColors.textPrimary,
    surfaceVariant: wealthColors.surfaceHighlight,
    onSurfaceVariant: wealthColors.textSecondary,

    // Fix for AppText using non-MD3 keys
    textPrimary: wealthColors.textPrimary,
    textSecondary: wealthColors.textSecondary,
    textMuted: wealthColors.textMuted,

    outline: '#E2E8F0', // Light border
    outlineVariant: 'rgba(148, 163, 184, 0.1)',

    error: wealthColors.error,
    onError: '#FFFFFF',

    // Custom wealth namespace for specialized usage
    wealth: {
      background: wealthColors.background,
      surface: wealthColors.surface,
      surfaceHighlight: wealthColors.surfaceHighlight,
      primary: wealthColors.primary,
      primaryLight: wealthColors.primaryLight,
      primaryDark: wealthColors.primaryDark,
      primaryGlow: wealthColors.primaryGlow,
      textPrimary: wealthColors.textPrimary,
      textSecondary: wealthColors.textSecondary,
      textMuted: wealthColors.textMuted,
      error: wealthColors.error,
      success: wealthColors.success,
      warning: wealthColors.warning,
      chartStroke: wealthColors.primary,
      chartFillStart: 'rgba(37, 99, 235, 0.2)',
      chartFillEnd: 'rgba(37, 99, 235, 0)',
      border: '#E2E8F0',

      // Fusion Design System: Functional Colors (方案二的颜色逻辑)
      functional: {
        expense: '#EF4444', // Red 500 - 支出、警告
        income: '#10B981', // Emerald 500 - 收入、增长
        budget: '#059669', // Emerald 600 - 预算模块
        ai: '#7C3AED', // Violet 600 - AI 分析
      },

      // Fusion Design System: Gradients for Headers (方案一的渐变 + 方案二的功能色)
      gradients: {
        header: ['#1E293B', '#0F172A'], // 标准深色页头
        ai: ['#4C1D95', '#7C3AED'], // AI 页面紫色渐变
        budget: ['#064E3B', '#059669'], // 预算页面绿色渐变
        expense: ['#7F1D1D', '#EF4444'], // 支出页面红色渐变
        income: ['#064E3B', '#10B981'], // 收入页面绿色渐变
      },
    },

    // Legacy gradients
    gradientStart: wealthColors.surface,
    gradientEnd: wealthColors.background,
  },
  roundness: 16,

  // Fusion Design System: Unified Spacing
  spacing: {
    xs: 4,   // 微调
    sm: 8,   // 组件内间距
    md: 16,  // 标准间距
    lg: 24,  // 区块间距
    xl: 32,  // 宽松布局
    xxl: 48, // 大留白
  },

  // Fusion Design System: Unified Radii
  radii: {
    sm: 8,    // 小组件
    md: 16,   // 内部容器
    lg: 24,   // 标准卡片 (方案一核心)
    xl: 32,   // 头部圆角、模态框顶部
    full: 9999, // 按钮、输入框、标签
  },

  // Fusion Design System: Elevation System
  shadows: {
    small: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    // Float Shadow (Level 2 - 悬浮元素)
    float: {
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 30,
      elevation: 12,
    },
  },

  // Typography configuration
  typography: {
    header: {
      fontSize: 28,
      fontWeight: '700' as '700',
      lineHeight: 34,
      letterSpacing: -0.5,
    },
    title: {
      fontSize: 20,
      fontWeight: '600' as '600',
      lineHeight: 26,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as '400',
      lineHeight: 24,
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as '400',
      lineHeight: 18,
      color: wealthColors.textSecondary,
    },
  },
};

// Export as default theme
export const theme = WealthTheme;

export type AppTheme = typeof theme;
