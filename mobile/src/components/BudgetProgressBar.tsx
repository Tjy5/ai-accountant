import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { theme } from '../theme';

interface BudgetProgressBarProps {
  percentage: number;
  animated?: boolean;
  style?: ViewStyle;
}

const getColor = (pct: number): string => {
  if (pct < 50) return '#10B981';
  if (pct < 80) return '#F59E0B';
  return '#EF4444';
};

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  percentage,
  animated = true,
  style,
}) => {
  const [barWidth, setBarWidth] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const clampedRatio = Math.min(Math.max(percentage / 100, 0), 1);
  const color = getColor(percentage);

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
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              transform: [{ scaleX: animValue }, { translateX }],
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    borderRadius: 4,
  },
});
