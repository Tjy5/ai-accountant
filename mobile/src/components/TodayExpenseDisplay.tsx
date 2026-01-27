import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from './AppText';

interface TodayExpenseDisplayProps {
  amount: number;
  animated?: boolean;
  style?: ViewStyle;
}

export const TodayExpenseDisplay: React.FC<TodayExpenseDisplayProps> = ({
  amount,
  animated = true,
  style,
}) => {
  const [displayValue, setDisplayValue] = useState(amount);
  const animValue = useRef(new Animated.Value(amount)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animValue, {
        toValue: amount,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animValue.setValue(amount);
      setDisplayValue(amount);
    }
  }, [amount, animated, animValue]);

  useEffect(() => {
    const listenerId = animValue.addListener(({ value }) => {
      setDisplayValue(value);
    });
    return () => animValue.removeListener(listenerId);
  }, [animValue]);

  return (
    <View style={[styles.container, style]}>
      <AppText style={styles.label}>今日支出</AppText>
      <AppText style={styles.amount}>
        ¥{displayValue.toFixed(0)}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
});
