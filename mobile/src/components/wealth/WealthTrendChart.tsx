import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Svg, Defs, LinearGradient as SvgLinearGradient, Stop, Line, Circle, Path } from 'react-native-svg';
import { theme } from '../../theme';
import { AppText } from '../AppText';

interface DataPoint {
  x: string;
  y: number;
}

interface WealthTrendChartProps {
  data: DataPoint[];
  height?: number;
  width?: number;
  showGrid?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export const WealthTrendChart: React.FC<WealthTrendChartProps> = ({
  data,
  height = 200,
  width = SCREEN_WIDTH - 48,
  showGrid = true,
}) => {
  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <AppText variant="caption" color={theme.colors.wealth?.textMuted} centered>
          暂无数据
        </AppText>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.y)) * 1.2;
  const minValue = 0;
  const range = maxValue - minValue;

  const chartHeight = height - 40; // Leave space for labels
  const chartWidth = width - 40; // Leave space for labels

  const points = data.map((d, i) => {
    const x = 20 + (i / (data.length - 1)) * chartWidth;
    const y = 20 + chartHeight - ((d.y - minValue) / range) * chartHeight;
    return { x, y, label: d.x, value: d.y };
  });

  // Create area path
  const areaPath = points.reduce((acc, point, i) => {
    if (i === 0) {
      return `M ${point.x} ${chartHeight + 20} L ${point.x} ${point.y}`;
    }
    return `${acc} L ${point.x} ${point.y}`;
  }, '') + ` L ${points[points.length - 1].x} ${chartHeight + 20} Z`;

  // Create line path
  const linePath = points.reduce((acc, point, i) => {
    if (i === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${acc} L ${point.x} ${point.y}`;
  }, '');

  return (
    <View style={[styles.container, { width }]}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={theme.colors.wealth?.primary || '#10B981'}
              stopOpacity="0.4"
            />
            <Stop
              offset="100%"
              stopColor={theme.colors.wealth?.primary || '#10B981'}
              stopOpacity="0"
            />
          </SvgLinearGradient>
        </Defs>

        {/* Area fill */}
        <Path d={areaPath} fill="url(#wealthGradient)" />

        {/* Line */}
        <Path
          d={linePath}
          stroke={theme.colors.wealth?.primary || '#10B981'}
          strokeWidth={3}
          fill="none"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={theme.colors.wealth?.surface || '#0F172A'}
            stroke={theme.colors.wealth?.primary || '#10B981'}
            strokeWidth={2}
          />
        ))}
      </Svg>

      {/* X-axis labels */}
      <View style={styles.labelsContainer}>
        {points.map((point, index) => (
          <AppText
            key={index}
            variant="caption"
            color={theme.colors.wealth?.textMuted}
            style={[styles.label, { left: point.x - 15 }]}
          >
            {point.label}
          </AppText>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  labelsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    position: 'absolute',
    fontSize: 10,
  },
});
