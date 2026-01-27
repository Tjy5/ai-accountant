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

export type WealthCardVariant = 'elevated' | 'flat' | 'glass';
export type WealthCardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface WealthCardProps {
  children: ReactNode;
  variant?: WealthCardVariant;
  padding?: WealthCardPadding;
  onPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export const WealthCard: React.FC<WealthCardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  onPress,
  style,
  contentStyle,
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
    ...(variant === 'elevated' ? theme.shadows.small : {}),
    ...(variant === 'glass' ? {
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    } : {}),
  };

  const Wrapper = onPress ? Pressable : View;
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
