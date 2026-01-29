import React, { useState, useRef } from 'react';
import {
  Text,
  TextInput,
  View,
  StyleSheet,
  Animated,
  TextInputProps,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppTheme } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  style,
  onFocus,
  onBlur,
  error,
  ...props
}) => {
  const theme = useTheme<AppTheme>();
  const [isFocused, setIsFocused] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false, // interacting with border/shadow
    }).start();
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    if (onBlur) onBlur(e);
  };

  const hasError = Boolean(error);

  const borderColor = hasError
    ? theme.colors.error
    : glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.colors.outline, theme.colors.primary],
      });

  const shadowOpacity = hasError
    ? 0.18
    : glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.2],
      });

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            borderColor,
            borderWidth: 2,
            borderRadius: 14, // Outer radius slightly larger
            shadowColor: hasError ? theme.colors.error : theme.colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity,
            shadowRadius: 8,
            elevation: isFocused ? 4 : 0,
          },
        ]}
      >
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.wealth.surfaceHighlight,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.text,
              },
              style,
            ]}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={theme.colors.wealth.textMuted}
            {...props}
          />
        </View>
      </Animated.View>

      {hasError ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
  },
  container: {
    borderRadius: 14,
  },
  inputContainer: {
    borderRadius: 12, // 12px inner radius
    paddingHorizontal: 16,
    height: 50,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    height: '100%',
  },
  errorText: {
    marginTop: 6,
    marginLeft: 12,
    fontSize: 12,
  },
});
