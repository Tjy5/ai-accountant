import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { AppText } from '../AppText';

interface AssetHeroCardProps {
  netWorth: number;
  income: number;
  expense: number;
  trend?: number; // 趋势百分比，如 +12.5
  style?: ViewStyle;
}

export const AssetHeroCard: React.FC<AssetHeroCardProps> = ({
  netWorth,
  income,
  expense,
  trend,
  style,
}) => {
  const trendColor = trend && trend > 0 ? theme.colors.wealth?.primary : theme.colors.wealth?.textMuted;
  const trendPrefix = trend && trend > 0 ? '+' : '';

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[theme.colors.wealth?.surface || '#0F172A', theme.colors.wealth?.background || '#02040A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* 标题 */}
        <AppText variant="caption" color={theme.colors.wealth?.textSecondary} style={styles.title}>
          净资产 NET WORTH
        </AppText>

        {/* 主数字 */}
        <AppText
          variant="header"
          color={theme.colors.wealth?.textPrimary}
          bold
          style={styles.netWorth}
        >
          ¥{netWorth.toFixed(2)}
        </AppText>

        {/* 趋势指示器 */}
        {trend !== undefined && (
          <View style={styles.trendContainer}>
            <AppText variant="caption" color={trendColor} style={styles.trend}>
              {trendPrefix}{trend.toFixed(1)}%
            </AppText>
            <AppText variant="caption" color={theme.colors.wealth?.textMuted} style={styles.trendLabel}>
              本月收益
            </AppText>
          </View>
        )}

        {/* 分隔线 */}
        <View style={styles.divider} />

        {/* 资金流入 */}
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <View style={[styles.badge, { backgroundColor: theme.colors.wealth?.primaryGlow }]}>
              <AppText variant="caption" color={theme.colors.wealth?.primaryLight}>资金流入</AppText>
            </View>
            <AppText variant="title" color={theme.colors.wealth?.textPrimary} style={styles.metricValue}>
              +¥{income.toFixed(0)}
            </AppText>
          </View>

          {/* 中间分隔 */}
          <View style={[styles.verticalDivider, { backgroundColor: theme.colors.wealth?.surfaceHighlight }]} />

          {/* 运营成本 */}
          <View style={styles.metricItem}>
            <View style={[styles.badge, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
              <AppText variant="caption" color={theme.colors.wealth?.textSecondary}>运营成本</AppText>
            </View>
            <AppText variant="title" color={theme.colors.wealth?.textPrimary} style={styles.metricValue}>
              -¥{expense.toFixed(0)}
            </AppText>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.roundness,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.wealth?.border || 'rgba(16, 185, 129, 0.2)',
    backgroundColor: theme.colors.wealth?.surface || '#0F172A',
    ...theme.shadows.medium,
  },
  gradient: {
    padding: theme.spacing.lg,
  },
  title: {
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  netWorth: {
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontSize: 42,
    lineHeight: 48,
  },
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  trend: {
    fontWeight: '700',
  },
  trendLabel: {
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.wealth?.surfaceHighlight || '#1E293B',
    marginVertical: theme.spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: theme.spacing.xs,
  },
  metricValue: {
    fontSize: 18,
  },
  verticalDivider: {
    width: 1,
    height: 40,
  },
});
