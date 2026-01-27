import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, Dimensions, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { VictoryPie, VictoryChart, VictoryTheme, VictoryAxis, VictoryBar, VictoryLine } from 'victory-native';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardStats, getCategoryStats, getMonthlyTrend } from '../../storage/localDB';
import { theme } from '../../theme';
import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/ScreenContainer';
import { WealthCard } from '../../components/WealthCard';

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

  // Custom Header Content for ScreenContainer
  const renderHeaderContent = () => (
    <View style={styles.headerContentWrapper}>
      <View style={styles.headerTopRow}>
        <AppText variant="title" color="rgba(255,255,255,0.95)" style={{ fontSize: 20 }}>本月概览</AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.6)">{new Date().getMonth() + 1}月</AppText>
      </View>
      <View style={styles.headerBalance}>
        <AppText variant="caption" color="rgba(255,255,255,0.7)">本月结余</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
          <AppText style={[styles.balanceAmount, { color: '#FFFFFF' }]}>
            {netIncome >= 0 ? '+' : ''}{netIncome.toFixed(2)}
          </AppText>
          <AppText style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)', marginLeft: 4 }}>CN¥</AppText>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScreenContainer
      headerType="large"
      headerContent={renderHeaderContent()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#0F172A']} tintColor="#0F172A" />}
      enableScroll={true}
      contentStyle={{ paddingBottom: 40 }}
    >
      {/* Floating Summary Cards - Now using WealthCard */}
      <View style={styles.summaryRowWrapper}>
        <WealthCard style={[styles.summaryCard, { flex: 1, marginRight: 8 }]} padding="md" variant="elevated">
            <View style={styles.statItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                <AppText style={{ color: '#059669', fontSize: 16 }}>↓</AppText>
              </View>
              <View>
                <AppText variant="caption" color={theme.colors.textSecondary}>收入</AppText>
                <AppText variant="body" bold style={{ color: '#059669', fontSize: 16 }}>{summary.income.toFixed(0)}</AppText>
              </View>
            </View>
        </WealthCard>
        <WealthCard style={[styles.summaryCard, { flex: 1, marginLeft: 8 }]} padding="md" variant="elevated">
            <View style={styles.statItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                <AppText style={{ color: '#DC2626', fontSize: 16 }}>↑</AppText>
              </View>
              <View>
                <AppText variant="caption" color={theme.colors.textSecondary}>支出</AppText>
                <AppText variant="body" bold style={{ color: '#DC2626', fontSize: 16 }}>{summary.expense.toFixed(0)}</AppText>
              </View>
            </View>
        </WealthCard>
      </View>

      <View style={styles.contentContainer}>
        {error && (
          <WealthCard style={styles.errorCard} variant="flat">
            <AppText color={theme.colors.error}>{error}</AppText>
          </WealthCard>
        )}

        <View style={styles.sectionHeader}>
          <AppText variant="title" bold style={styles.sectionTitle}>支出分布</AppText>
        </View>

        <WealthCard style={styles.card} padding="lg">
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
        </WealthCard>

        <View style={styles.sectionHeader}>
          <AppText variant="title" bold style={styles.sectionTitle}>收支趋势</AppText>
          <AppText variant="caption" color={theme.colors.textSecondary}>近6个月</AppText>
        </View>

        <WealthCard style={styles.card}>
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
        </WealthCard>

        <View style={styles.sectionHeader}>
          <AppText variant="title" bold style={styles.sectionTitle}>排行榜</AppText>
        </View>

        <WealthCard style={styles.card} padding="none">
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
        </WealthCard>

        <View style={{ height: 40 }} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },

  // Header Content Styles
  headerContentWrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  headerBalance: {
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 60,
    includeFontPadding: false,
    paddingVertical: 5,
  },

  contentContainer: {
    marginTop: 10,
  },

  // Summary Cards
  summaryRowWrapper: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  summaryCard: {
    // handled by WealthCard
  },

  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#F1F5F9',
  },
  errorCard: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 24,
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
    borderBottomColor: '#F1F5F9',
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
