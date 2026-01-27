import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface GradientBackgroundProps {
    children: React.ReactNode;
    style?: ViewStyle;
    height?: number;
}

export const GradientBackground: React.FC<GradientBackgroundProps> = ({ children, style, height }) => {
    return (
        <LinearGradient
            colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.container, style, height ? { height } : {}]}
        >
            {children}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        padding: theme.spacing.md,
    },
});
