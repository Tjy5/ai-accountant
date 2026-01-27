import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, Dimensions, RefreshControl, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { VictoryPie, VictoryChart, VictoryTheme, VictoryAxis, VictoryBar, VictoryLine } from 'victory-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardStats, getCategoryStats, getMonthlyTrend } from '../../storage/localDB';
import { theme } from '../../theme';
import { AppCard } from '../../components/AppCard';
import { AppText } from '../../components/AppText';
import { ScreenWrapper } from '../../components/ScreenWrapper';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Custom premium palette for charts - slightly muted for elegance
const CHART_COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#a855f7', '#6366f1'
];

const toYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ income: 0, expense: 0, count: 0 });
  const [categoryData, setCategoryData] = useState<Array<{ category: string; total: number }>>([]);
  const [trendData, setTrendData] = useState<Array<{ month: string; type: 'income' | 'expense'; total: number }>>([]);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const now = new Date();
      const startOfMonth = toYmd(new Date(now.getFullYear(), now.getMonth(), 1));
      const endOfMonth = toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const startOf6MonthsAgo = toYmd(new Date(now.getFullYear(), now.getMonth() - 5, 1));

      const [stats, cats, trends] = await Promise.all([
        getDashboardStats(user.id, startOfMonth, endOfMonth),
        getCategoryStats(user.id, startOfMonth, endOfMonth),
        getMonthlyTrend(user.id, startOf6MonthsAgo)
      ]);

      setSummary(stats);
      setCategoryData(cats);
      setTrendData(trends);
    } catch (e: any) {
      console.error('Failed to load dashboard stats:', e);
      setError(e?.message ? String(e.message) : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const pieData = useMemo(() =>
    categoryData.map(c => ({ x: c.category, y: c.total })),
    [categoryData]
  );

  const trendChartData = useMemo(() => {
    const months = [...new Set(trendData.map(t => t.month))].sort();
    return {
      income: months.map(m => {
        const item = trendData.find(t => t.month === m && t.type === 'income');
        return { x: m.substring(5), y: item?.total || 0 };
      }),
      expense: months.map(m => {
        const item = trendData.find(t => t.month === m && t.type === 'expense');
        return { x: m.substring(5), y: item?.total || 0 };
      })
    };
  }, [trendData]);

  const netIncome = summary.income - summary.expense;

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#0F172A']} tintColor="#0F172A" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header Backdrop */}
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerTopRow}>
            <AppText variant="title" color="rgba(255,255,255,0.95)" style={{ fontSize: 20 }}>本月概览</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.6)">{new Date().getMonth() + 1}月</AppText>
          </View>
        </LinearGradient>

        {/* Floating Summary Card */}
        <View style={styles.summaryCardWrapper}>
          <AppCard style={styles.summaryCard} padding="lg">
            <View style={styles.balanceSection}>
              <AppText variant="caption" color={theme.colors.textSecondary} style={{ marginBottom: 4 }}>本月结余</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 8 }}>
                <AppText style={[styles.balanceAmount, { color: netIncome >= 0 ? theme.colors.primary : theme.colors.error }]}>
                  {netIncome >= 0 ? '+' : ''}{netIncome.toFixed(2)}
                </AppText>
                <AppText style={{ fontSize: 16, color: theme.colors.textSecondary, marginLeft: 4, fontWeight: 'normal' }}>CN¥</AppText>
              </View>
            </View>

            <View style={styles.dividerHorizontal} />

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                  {/* Using text char as simple icon placeholder if needed, or just color */}
                  <AppText style={{ color: '#059669', fontSize: 16 }}>↓</AppText>
                </View>
                <View>
                  <AppText variant="caption" color={theme.colors.textSecondary}>收入</AppText>
                  <AppText variant="body" bold style={{ color: '#059669', fontSize: 16 }}>{summary.income.toFixed(0)}</AppText>
                </View>
              </View>

              <View style={styles.verticalRule} />

              <View style={styles.statItem}>
                <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                  <AppText style={{ color: '#DC2626', fontSize: 16 }}>↑</AppText>
                </View>
                <View>
                  <AppText variant="caption" color={theme.colors.textSecondary}>支出</AppText>
                  <AppText variant="body" bold style={{ color: '#DC2626', fontSize: 16 }}>{summary.expense.toFixed(0)}</AppText>
                </View>
              </View>
            </View>
          </AppCard>
        </View>

        <View style={styles.contentContainer}>
          {error && (
            <AppCard style={styles.errorCard}>
              <AppText color={theme.colors.error}>{error}</AppText>
            </AppCard>
          )}

          <View style={styles.sectionHeader}>
            <AppText variant="title" bold style={styles.sectionTitle}>支出分布</AppText>
          </View>

          <AppCard style={styles.card} padding="lg">
            {pieData.length > 0 ? (
              <View style={{ alignItems: 'center' }}>
                <VictoryPie
                  data={pieData}
                  colorScale={CHART_COLORS}
                  innerRadius={80}
                  radius={({ datum }) => 100 + (datum.y / summary.expense) * 15}
                  padAngle={2}
                  height={280}
                  width={SCREEN_WIDTH - 64}
                  style={{ labels: { fill: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' } }}
                />
              </View>
            ) : (
              <AppText centered style={styles.emptyText}>本月暂无支出</AppText>
            )}
          </AppCard>

          <View style={styles.sectionHeader}>
            <AppText variant="title" bold style={styles.sectionTitle}>收支趋势</AppText>
            <AppText variant="caption" color={theme.colors.textSecondary}>近6个月</AppText>
          </View>

          <AppCard style={styles.card}>
            {trendChartData.income.length > 0 || trendChartData.expense.length > 0 ? (
              <>
                <VictoryChart width={SCREEN_WIDTH - 48} height={250} theme={VictoryTheme.material} padding={{ top: 20, bottom: 40, left: 50, right: 20 }}>
                  <VictoryAxis style={{
                    grid: { stroke: 'none' },
                    axis: { stroke: theme.colors.outline },
                    tickLabels: { fill: theme.colors.textSecondary, fontSize: 10 }
                  }} />
                  <VictoryAxis dependentAxis tickFormat={(t: any) => `${(t / 1000).toFixed(0)}k`}
                    style={{
                      grid: { stroke: theme.colors.surfaceVariant, strokeDasharray: '4, 4' },
                      axis: { stroke: 'none' },
                      tickLabels: { fill: theme.colors.textSecondary, fontSize: 10 }
                    }}
                  />
                  <VictoryLine
                    data={trendChartData.income}
                    style={{ data: { stroke: '#10B981', strokeWidth: 3 }, parent: { border: "none" } }}
                    animate={{ duration: 1000, onLoad: { duration: 500 } }}
                    interpolation="catmullRom"
                  />
                  <VictoryLine
                    data={trendChartData.expense}
                    style={{ data: { stroke: theme.colors.error, strokeWidth: 3 } }}
                    animate={{ duration: 1000, onLoad: { duration: 500 } }}
                    interpolation="catmullRom"
                  />
                </VictoryChart>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                    <AppText variant="caption">收入</AppText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
                    <AppText variant="caption">支出</AppText>
                  </View>
                </View>
              </>
            ) : (
              <AppText centered style={styles.emptyText}>暂无数据</AppText>
            )}
          </AppCard>

          <View style={styles.sectionHeader}>
            <AppText variant="title" bold style={styles.sectionTitle}>排行榜</AppText>
          </View>

          <AppCard style={styles.card} padding="none">
            {pieData.length > 0 ? (
              <View style={{ paddingVertical: 12 }}>
                {categoryData.slice(0, 5).map((item, index) => (
                  <View key={item.category} style={styles.rankItem}>
                    <View style={styles.rankIndex}>
                      <AppText bold color={index < 3 ? '#1E293B' : theme.colors.textSecondary} style={{ fontSize: 16 }}>{index + 1}</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <AppText bold style={{ color: theme.colors.textPrimary }}>{item.category}</AppText>
                        <AppText bold style={{ color: theme.colors.textPrimary }}>¥{item.total.toFixed(0)}</AppText>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${(item.total / summary.expense) * 100}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }]} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <AppText centered style={styles.emptyText}>暂无数据</AppText>
            )}
          </AppCard>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  scrollContainer: { flex: 1 },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 10,
  },
  headerBalance: {
    marginTop: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 4,
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: 0, // Reset overlapped margin
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40, // Space for curve
  },
  summaryCardWrapper: {
    paddingHorizontal: 20,
    marginTop: -50, // Pull up into gradient
    marginBottom: 20, // Space before next content
    zIndex: 10,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 0,
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 65, // Generous line height
    includeFontPadding: false, // Fix check for Android clipping
    paddingVertical: 5,
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  verticalRule: {
    width: 1,
    height: 40,
    backgroundColor: '#F1F5F9',
  },
  errorCard: {
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 24,
    borderWidth: 0, // Removed border for cleaner look
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingHorizontal: 4,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1E293B',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    paddingVertical: 40,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9', // Subtle divider
  },
  rankIndex: {
    width: 30,
    alignItems: 'center',
    marginRight: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
