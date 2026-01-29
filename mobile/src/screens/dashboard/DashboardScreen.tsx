import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Dimensions, RefreshControl, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { VictoryPie, VictoryChart, VictoryTheme, VictoryAxis, VictoryLine } from 'victory-native';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardStats, getCategoryStats, getMonthlyTrend } from '../../storage/localDB';
import { theme } from '../../theme';
import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card/Card';
import { CountUp } from '../../components/CountUp';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
        <View>
          <AppText variant="title" color="rgba(255,255,255,0.95)" style={{ fontSize: 24, fontWeight: '700' }}>本月概览</AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.7)">{new Date().getFullYear()}年{new Date().getMonth() + 1}月</AppText>
        </View>
        <Pressable style={styles.headerIconBtn}>
          <MaterialCommunityIcons name="bell-outline" size={24} color="#FFF" />
        </Pressable>
      </View>
      <View style={styles.headerBalance}>
        <AppText variant="caption" color="rgba(255,255,255,0.8)" style={{ marginBottom: 4 }}>本月结余</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
          <CountUp
            end={netIncome}
            decimals={2}
            style={[styles.balanceAmount, { color: '#FFFFFF' }]}
          />
          <AppText style={{ fontSize: 24, color: 'rgba(255,255,255,0.9)', marginLeft: 6, fontWeight: '600' }}>CN¥</AppText>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
      enableScroll={true}
      contentStyle={{ paddingBottom: 40 }}
      headerGradient={theme.colors.wealth.gradients.header}
    >
      {/* Floating Summary Cards - Reverted to Classic Style */}
      <View style={styles.summaryRowWrapper}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Card onPress={() => { }} style={styles.summaryCard}>
            <View style={styles.statItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                <AppText style={{ color: '#059669', fontSize: 12 }}>↓</AppText>
              </View>
              <View>
                <AppText variant="caption" color={theme.colors.textSecondary}>收入</AppText>
                <CountUp
                  end={summary.income}
                  decimals={0}
                  style={{ color: '#059669', fontSize: 15, fontWeight: '700' }}
                />
              </View>
            </View>
          </Card>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Card onPress={() => { }} style={styles.summaryCard}>
            <View style={styles.statItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                <AppText style={{ color: '#DC2626', fontSize: 12 }}>↑</AppText>
              </View>
              <View>
                <AppText variant="caption" color={theme.colors.textSecondary}>支出</AppText>
                <CountUp
                  end={summary.expense}
                  decimals={0}
                  style={{ color: '#DC2626', fontSize: 15, fontWeight: '700' }}
                />
              </View>
            </View>
          </Card>
        </View>
      </View>

      <View style={styles.contentContainer}>
        {error && (
          <Card style={styles.errorCard}>
            <View style={{ padding: 16 }}>
              <AppText color={theme.colors.error}>{error}</AppText>
            </View>
          </Card>
        )}

        {/* Expense Distribution */}
        <View style={styles.sectionHeader}>
          <AppText variant="title" bold style={styles.sectionTitle}>支出分布</AppText>
        </View>

        <Card style={styles.card}>
          <View style={{ padding: 24, alignItems: 'center' }}>
            {pieData.length > 0 ? (
              <VictoryPie
                data={pieData}
                colorScale={CHART_COLORS}
                innerRadius={80}
                radius={({ datum }) => 100 + (datum.y / summary.expense) * 10}
                padAngle={3}
                cornerRadius={5}
                height={280}
                width={SCREEN_WIDTH - 64}
                style={{ labels: { fill: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' } }}
              />
            ) : (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={['rgba(148, 163, 184, 0.1)', 'rgba(148, 163, 184, 0.05)']}
                  style={styles.emptyIconBg}
                >
                  <MaterialCommunityIcons name="chart-pie" size={48} color={theme.colors.textMuted} />
                </LinearGradient>
                <AppText centered style={styles.emptyText}>本月暂无支出</AppText>
              </View>
            )}
          </View>
        </Card>

        {/* Trend Chart */}
        <View style={styles.sectionHeader}>
          <AppText variant="title" bold style={styles.sectionTitle}>收支趋势</AppText>
          <View style={styles.badge}>
            <AppText variant="caption" color={theme.colors.primary} bold>近6个月</AppText>
          </View>
        </View>

        <Card style={styles.card}>
          {trendChartData.income.length > 0 || trendChartData.expense.length > 0 ? (
            <>
              <VictoryChart width={SCREEN_WIDTH - 48} height={250} theme={VictoryTheme.material} padding={{ top: 20, bottom: 40, left: 50, right: 20 }}>
                <VictoryAxis style={{
                  grid: { stroke: 'none' },
                  axis: { stroke: 'transparent' },
                  tickLabels: { fill: theme.colors.textMuted, fontSize: 11, padding: 5 }
                }} />
                <VictoryAxis dependentAxis tickFormat={(t: any) => `${(t / 1000).toFixed(0)}k`}
                  style={{
                    grid: { stroke: theme.colors.outlineVariant, strokeDasharray: '4, 4' },
                    axis: { stroke: 'none' },
                    tickLabels: { fill: theme.colors.textMuted, fontSize: 11 }
                  }}
                />
                <VictoryLine
                  data={trendChartData.income}
                  style={{ data: { stroke: theme.colors.wealth.functional.income, strokeWidth: 4 } }}
                  animate={{ duration: 1000, onLoad: { duration: 500 } }}
                  interpolation="catmullRom"
                />
                <VictoryLine
                  data={trendChartData.expense}
                  style={{ data: { stroke: theme.colors.wealth.functional.expense, strokeWidth: 4 } }}
                  animate={{ duration: 1000, onLoad: { duration: 500 } }}
                  interpolation="catmullRom"
                />
              </VictoryChart>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: theme.colors.wealth.functional.income }]} />
                  <AppText variant="caption">收入</AppText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: theme.colors.wealth.functional.expense }]} />
                  <AppText variant="caption">支出</AppText>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <AppText centered style={styles.emptyText}>暂无趋势数据</AppText>
            </View>
          )}
        </Card>

        {/* Ranking List */}
        <View style={styles.sectionHeader}>
          <AppText variant="title" bold style={styles.sectionTitle}>排行 Top 5</AppText>
        </View>

        <Card style={styles.card} noPadding>
          {pieData.length > 0 ? (
            <View style={{ paddingVertical: 12 }}>
              {categoryData.slice(0, 5).map((item, index) => (
                <View key={item.category} style={styles.rankItem}>
                  <View style={styles.rankIndex}>
                    <AppText bold color={index < 3 ? theme.colors.primary : theme.colors.textSecondary} style={{ fontSize: 16 }}>{index + 1}</AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <AppText bold style={{ color: theme.colors.textPrimary, fontSize: 15 }}>{item.category}</AppText>
                      <AppText bold style={{ color: theme.colors.textPrimary, fontSize: 15 }}>¥ {item.total.toFixed(0)}</AppText>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${(item.total / summary.expense) * 100}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}><AppText centered style={styles.emptyText}>暂无数据</AppText></View>
          )}
        </Card>

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
    paddingTop: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerBalance: {
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 50,
    includeFontPadding: false,
    paddingVertical: 5,
  },

  contentContainer: {
    marginTop: 20,
  },

  // Summary Cards (Reverted styles)
  summaryRowWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    marginTop: 10, // Adjusted to avoid overlapping with large balance
    alignItems: 'flex-start',
  },
  summaryCard: {
    overflow: 'hidden',
  },

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#1E293B',
    fontWeight: '700',
  },
  badge: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  rankIndex: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
