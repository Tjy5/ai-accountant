import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface BudgetProgressBarProps {
  percentage: number;
  animated?: boolean;
  style?: ViewStyle;
  height?: number;
}

const getColorGradient = (pct: number): [string, string] => {
  if (pct < 50) return ['#10B981', '#059669'];
  if (pct < 80) return ['#F59E0B', '#D97706'];
  return ['#EF4444', '#DC2626'];
};

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  percentage,
  animated = true,
  style,
  height = 10,
}) => {
  const [barWidth, setBarWidth] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const clampedRatio = Math.min(Math.max(percentage / 100, 0), 1);
  const [colorStart, colorEnd] = getColorGradient(percentage);

  useEffect(() => {
    if (barWidth === 0) return;

    if (animated) {
      Animated.spring(animValue, {
        toValue: clampedRatio,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start();
    } else {
      animValue.setValue(clampedRatio);
    }
  }, [clampedRatio, animated, barWidth, animValue]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth / 2, 0],
  });

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <View style={[styles.track, { height }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              transform: [{ scaleX: animValue }, { translateX }],
            },
          ]}
        >
          <LinearGradient
            colors={[colorStart, colorEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFill}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    borderRadius: 8,
  },
  gradientFill: {
    flex: 1,
    borderRadius: 8,
  },
});
