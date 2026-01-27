import React from 'react';
import { View, StyleSheet, StatusBar, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    backgroundColor?: string;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
    children,
    style,
    backgroundColor = theme.colors.background
}) => {
    // Use light-content for Wealth Theme (dark background)
    const barStyle = 'light-content';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor }, style]} edges={['top']}>
            <StatusBar barStyle={barStyle} backgroundColor={backgroundColor} />
            <View style={{ flex: 1 }}>
                {children}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
