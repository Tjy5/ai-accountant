import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  Platform,
  Pressable,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'glass';
  onPress?: () => void;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  onPress,
  noPadding = false,
}) => {
  const theme = useTheme<AppTheme>();
  const translateY = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(theme.shadows.small.shadowOpacity)).current;
  const elevation = useRef(new Animated.Value(theme.shadows.small.elevation)).current;

  const handlePressIn = () => {
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(translateY, {
        toValue: -4,
        duration: 150,
        useNativeDriver: false,
      }),
    ];

    if (Platform.OS === 'android') {
      animations.push(
        Animated.timing(elevation, {
          toValue: theme.shadows.medium.elevation,
          duration: 150,
          useNativeDriver: false,
        })
      );
    } else {
      animations.push(
        Animated.timing(shadowOpacity, {
          toValue: 0.2, // Enhanced shadow on hover/press
          duration: 150,
          useNativeDriver: false,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const handlePressOut = () => {
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(translateY, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ];

    if (Platform.OS === 'android') {
      animations.push(
        Animated.timing(elevation, {
          toValue: theme.shadows.small.elevation,
          duration: 150,
          useNativeDriver: false,
        })
      );
    } else {
      animations.push(
        Animated.timing(shadowOpacity, {
          toValue: theme.shadows.small.shadowOpacity,
          duration: 150,
          useNativeDriver: false,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const Container = onPress ? Pressable : View;

  // Glassmorphism background
  const glassBackground = variant === 'glass'
    ? 'rgba(255, 255, 255, 0.7)'
    : theme.colors.surface;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderRadius: theme.radii.lg, // Use theme radius (28)
          backgroundColor: glassBackground,
          transform: [{ translateY }],
          borderWidth: variant === 'glass' ? 1 : 0,
          borderColor: variant === 'glass' ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
          shadowColor: theme.shadows.small.shadowColor,
          shadowOffset: theme.shadows.small.shadowOffset,
          shadowOpacity: Platform.OS === 'android' ? 0.08 : shadowOpacity,
          shadowRadius: theme.shadows.small.shadowRadius,
          elevation: Platform.OS === 'android' ? elevation : theme.shadows.small.elevation,
        },
        style,
      ]}
    >
      <Container
        onPress={onPress}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        style={[
          styles.inner,
          !noPadding && styles.padding,
        ]}
      >
        {children}
      </Container>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10, // Increased vertical spacing
  },
  inner: {
    width: '100%',
    borderRadius: 28, // Matches theme.radii.lg
    overflow: 'hidden',
  },
  padding: {
    padding: 24, // Increased padding (theme.spacing.lg)
  },
});
