import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, Dimensions, RefreshControl } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { VictoryPie, VictoryChart, VictoryTheme, VictoryAxis, VictoryBar, VictoryLine } from 'victory-native';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardStats, getCategoryStats, getMonthlyTrend } from '../../storage/localDB';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLORS = ['#ff7875', '#ff9c6e', '#ffc069', '#ffd591', '#fff566', '#d3f261', '#95de64', '#5cdbd3'];

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

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {error ? (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{error}</Text>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, styles.incomeCard]}>
          <Card.Content>
            <Text variant="labelMedium" style={styles.cardLabel}>本月收入</Text>
            <Text variant="headlineSmall" style={styles.incomeText}>¥{summary.income.toFixed(0)}</Text>
          </Card.Content>
        </Card>
        <Card style={[styles.summaryCard, styles.expenseCard]}>
          <Card.Content>
            <Text variant="labelMedium" style={styles.cardLabel}>本月支出</Text>
            <Text variant="headlineSmall" style={styles.expenseText}>¥{summary.expense.toFixed(0)}</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.netCard}>
        <Card.Content style={styles.netContent}>
          <View>
            <Text variant="labelMedium" style={styles.cardLabel}>结余</Text>
            <Text variant="headlineMedium" style={[styles.netText, { color: netIncome >= 0 ? '#52c41a' : '#ff4d4f' }]}>
              ¥{netIncome.toFixed(2)}
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.countText}>共 {summary.count} 笔</Text>
        </Card.Content>
      </Card>

      <Card style={styles.chartCard} accessible accessibilityLabel={`支出分布图表: ${categoryData.map(c => `${c.category} ${c.total.toFixed(0)}元`).join(', ')}`}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.chartTitle}>支出分布</Text>
          {pieData.length > 0 ? (
            <VictoryPie
              data={pieData}
              colorScale={COLORS}
              innerRadius={60}
              height={280}
              width={SCREEN_WIDTH - 64}
              style={{ labels: { fill: '#666', fontSize: 11 } }}
            />
          ) : (
            <Text style={styles.emptyText}>本月暂无支出</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.chartCard} accessible accessibilityLabel="收支趋势图表">
        <Card.Content>
          <Text variant="titleMedium" style={styles.chartTitle}>收支趋势（近6个月）</Text>
          {trendChartData.income.length > 0 || trendChartData.expense.length > 0 ? (
            <>
              <VictoryChart width={SCREEN_WIDTH - 64} height={250} theme={VictoryTheme.material}>
                <VictoryLine
                  data={trendChartData.income}
                  style={{ data: { stroke: '#52c41a', strokeWidth: 2 } }}
                />
                <VictoryLine
                  data={trendChartData.expense}
                  style={{ data: { stroke: '#ff4d4f', strokeWidth: 2 } }}
                />
                <VictoryAxis style={{ grid: { stroke: '#f0f0f0' } }} />
                <VictoryAxis dependentAxis tickFormat={(t: any) => `${(t / 1000).toFixed(0)}k`} style={{ grid: { stroke: '#f0f0f0' } }} />
              </VictoryChart>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#52c41a' }]} />
                  <Text variant="bodySmall">收入</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#ff4d4f' }]} />
                  <Text variant="bodySmall">支出</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>暂无数据</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.chartCard} accessible accessibilityLabel={`支出排行图表: ${categoryData.slice(0, 5).map((c, i) => `第${i + 1}名 ${c.category}`).join(', ')}`}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.chartTitle}>支出排行 TOP 10</Text>
          {pieData.length > 0 ? (
            <VictoryChart width={SCREEN_WIDTH - 64} height={Math.max(200, pieData.length * 30)} domainPadding={{ x: 20 }}>
              <VictoryBar
                data={pieData}
                horizontal
                style={{ data: { fill: '#1890ff' } }}
                labels={({ datum }: { datum: any }) => `¥${datum.y.toFixed(0)}`}
              />
              <VictoryAxis style={{ grid: { stroke: 'none' } }} />
              <VictoryAxis dependentAxis style={{ grid: { stroke: '#f0f0f0' } }} />
            </VictoryChart>
          ) : (
            <Text style={styles.emptyText}>暂无数据</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorCard: { marginHorizontal: 16, marginTop: 16, marginBottom: 0, backgroundColor: '#fff2f0' },
  errorText: { color: '#f5222d' },
  summaryRow: { flexDirection: 'row', padding: 16, gap: 12 },
  summaryCard: { flex: 1 },
  incomeCard: { backgroundColor: '#f6ffed', borderLeftWidth: 3, borderLeftColor: '#52c41a' },
  expenseCard: { backgroundColor: '#fff1f0', borderLeftWidth: 3, borderLeftColor: '#ff4d4f' },
  netCard: { marginHorizontal: 16, marginBottom: 16 },
  netContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: '#666', marginBottom: 4 },
  incomeText: { color: '#52c41a', fontWeight: '700' },
  expenseText: { color: '#ff4d4f', fontWeight: '700' },
  netText: { fontWeight: '700' },
  countText: { color: '#999' },
  chartCard: { marginHorizontal: 16, marginBottom: 16 },
  chartTitle: { marginBottom: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', paddingVertical: 40 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
