import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

interface AppCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'elevated' | 'outlined' | 'flat';
    onPress?: () => void;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const AppCard: React.FC<AppCardProps> = ({
    children,
    style,
    variant = 'elevated',
    onPress,
    padding = 'md',
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
        backgroundColor: theme.colors.surface,
        borderRadius: theme.roundness,
        padding: getPadding(),
        // Premium Dark Mode: Subtle border for elevated cards too
        borderWidth: variant === 'outlined' ? 1 : (variant === 'elevated' ? StyleSheet.hairlineWidth : 0),
        borderColor: variant === 'outlined' ? theme.colors.outline : 'rgba(255,255,255,0.08)',
        ...(variant === 'elevated' ? theme.shadows.small : {}),
    };

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[cardStyle, style]}>
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={[cardStyle, style]}>{children}</View>;
};
