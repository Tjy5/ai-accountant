import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
} from 'react-native';
import { theme } from '../theme';

// ============================================
// WealthCard - Fusion Design System
// 统一卡片组件，替换现有的 AppCard
// 支持多种变体：elevated, flat, glass
// ============================================

export type WealthCardVariant = 'elevated' | 'flat' | 'glass' | 'receipt';
export type WealthCardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface WealthCardProps {
  children: ReactNode;
  variant?: WealthCardVariant;
  padding?: WealthCardPadding;
  onPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  cutoutColor?: string;
  cutoutRadius?: number;
}

export const WealthCard: React.FC<WealthCardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  onPress,
  style,
  contentStyle,
  cutoutColor = theme.colors.background,
  cutoutRadius = theme.radii.sm,
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'sm': return theme.spacing.sm;
      case 'lg': return theme.spacing.lg;
      default: return theme.spacing.md;
    }
  };

  const cardStyle: ViewStyle = {
    backgroundColor: variant === 'glass'
      ? 'rgba(255, 255, 255, 0.8)'
      : theme.colors.surface,
    borderRadius: theme.radii.lg, // 24px 标准卡片圆角
    padding: getPadding(),
    borderWidth: variant === 'flat' ? 1 : 0,
    borderColor: variant === 'flat' ? theme.colors.outline : undefined,
    ...((variant === 'elevated' || variant === 'receipt') ? theme.shadows.small : {}),
    ...(variant === 'glass' ? {
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    } : {}),
  };

  const Wrapper = onPress ? Pressable : View;

  // Receipt variant: special rendering with cutouts
  if (variant === 'receipt') {
    const outerStyle: ViewStyle = {
      ...theme.shadows.small,
      borderRadius: theme.radii.lg,
    };

    const innerStyle: ViewStyle = {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: getPadding(),
      overflow: 'hidden',
    };

    const cutoutStyle: ViewStyle = {
      position: 'absolute',
      width: cutoutRadius * 2,
      height: cutoutRadius * 2,
      borderRadius: cutoutRadius,
      backgroundColor: cutoutColor,
      top: 40,
    };

    const content = (
      <View style={[outerStyle, style]}>
        <View style={[innerStyle, contentStyle]}>
          {children}
        </View>
        <View style={[cutoutStyle, { left: -cutoutRadius }]} />
        <View style={[cutoutStyle, { right: -cutoutRadius }]} />
      </View>
    );

    if (onPress) {
      return (
        <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
          {content}
        </Pressable>
      );
    }
    return content;
  }

  // Default variants: elevated, flat, glass
  const wrapperProps = onPress ? {
    onPress,
    style: ({ pressed }: { pressed: boolean }) => [
      styles.card,
      cardStyle,
      style,
      pressed && styles.pressed,
    ],
  } : {
    style: [styles.card, cardStyle, style],
  };

  return (
    <Wrapper {...wrapperProps}>
      <View style={contentStyle}>
        {children}
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  pressed: {
    backgroundColor: theme.colors.surfaceVariant,
  },
});
