import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'react-native-paper';
import { AppTheme } from '../../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  size = 'medium',
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const theme = useTheme<AppTheme>();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.timing(translateAnim, {
        toValue: 2,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 10,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          height: 32,
          paddingHorizontal: 16,
          fontSize: 13,
        };
      case 'large':
        return {
          height: 56,
          paddingHorizontal: 32,
          fontSize: 18,
        };
      default: // medium
        return {
          height: 48,
          paddingHorizontal: 24,
          fontSize: 16,
        };
    }
  };

  const { height, paddingHorizontal, fontSize } = getSizeStyles();

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          transform: [{ scale: scaleAnim }, { translateY: translateAnim }],
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <TouchableOpacity
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
        activeOpacity={1}
        disabled={disabled}
      >
        <LinearGradient
          colors={theme.colors.wealth.gradients.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            {
              height,
              paddingHorizontal,
              borderRadius: 9999, // Capsule
            },
          ]}
        >
          {icon && <React.Fragment>{icon}</React.Fragment>}
          <Text
            style={[
              styles.text,
              {
                color: '#FFFFFF',
                fontSize,
                fontWeight: '600',
                marginLeft: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  text: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', // Fallback, normally should use theme fonts
  },
});
