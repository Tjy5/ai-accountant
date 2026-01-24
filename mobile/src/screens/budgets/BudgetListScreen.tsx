import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { listBudgets, queryAll, queryFirst, BudgetRecord } from '../../storage/localDB';
import { theme } from '../../theme';
import { PERIOD_LABELS, ALERT_COLORS, DEFAULT_ALERT_THRESHOLDS } from '../../../../shared/constants/budget';

type NavigationProp = any;

interface BudgetSection {
  title: string;
  data: BudgetRecord[];
}

const formatCurrency = (amount: number): string => `¥${amount.toFixed(2)}`;

const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getPeriodRange = (period: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'monthly') {
    const start = toYmd(new Date(year, month, 1));
    const end = toYmd(new Date(year, month + 1, 0));
    return { start, end };
  }
  if (period === 'quarterly') {
    const startMonth = Math.floor(month / 3) * 3;
    const start = toYmd(new Date(year, startMonth, 1));
    const end = toYmd(new Date(year, startMonth + 3, 0));
    return { start, end };
  }
  const start = toYmd(new Date(year, 0, 1));
  const end = toYmd(new Date(year, 12, 0));
  return { start, end };
};

const normalizeCategoryKey = (name: string): string => name.trim().toLowerCase();

const getBudgetLimit = (budget: BudgetRecord): number => {
  const monthly = Number(budget.monthly_limit) || 0;
  const period = budget.period || 'monthly';
  if (period === 'quarterly') {
    return budget.quarterly_limit != null ? Number(budget.quarterly_limit) : monthly * 3;
  }
  if (period === 'yearly') {
    return budget.yearly_limit != null ? Number(budget.yearly_limit) : monthly * 12;
  }
  return monthly;
};

export default function BudgetListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [spentMap, setSpentMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await listBudgets(user.id);
      setBudgets(rows);

      const uniquePeriods = Array.from(new Set(rows.map(b => b.period || 'monthly')));
      const periodAgg = new Map<string, { total: number; byCategory: Record<string, number> }>();

      for (const period of uniquePeriods) {
        const range = getPeriodRange(period);

        const totalRow = await queryFirst<{ total: number | null }>(
          `SELECT SUM(amount) as total FROM transactions
           WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense'
           AND DATE(date) >= ? AND DATE(date) <= ?`,
          [user.id, range.start, range.end]
        );

        const categoryRows = await queryAll<{ category_key: string | null; total: number | null }>(
          `SELECT LOWER(TRIM(category)) as category_key, SUM(amount) as total FROM transactions
           WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense'
           AND DATE(date) >= ? AND DATE(date) <= ?
           GROUP BY LOWER(TRIM(category))`,
          [user.id, range.start, range.end]
        );

        const byCategory: Record<string, number> = {};
        for (const row of categoryRows) {
          if (!row.category_key) continue;
          byCategory[String(row.category_key)] = Number(row.total) || 0;
        }

        periodAgg.set(period, { total: Number(totalRow?.total) || 0, byCategory });
      }

      const map: Record<number, number> = {};
      for (const b of rows) {
        const period = b.period || 'monthly';
        const agg = periodAgg.get(period) || { total: 0, byCategory: {} };
        if (b.budget_type === 'total') {
          map[b.id] = agg.total;
        } else if (b.category) {
          map[b.id] = agg.byCategory[normalizeCategoryKey(b.category)] || 0;
        } else {
          map[b.id] = 0;
        }
      }
      setSpentMap(map);
    } catch (e) {
      console.error('Failed to load budgets:', e);
      setBudgets([]);
      setSpentMap({});
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const totalBudget = useMemo(() => budgets.find(b => b.budget_type === 'total') || null, [budgets]);
  const categoryBudgets = useMemo(() => budgets.filter(b => b.budget_type === 'category'), [budgets]);

  const sections = useMemo<BudgetSection[]>(() => {
    const list: BudgetSection[] = [];
    if (totalBudget) list.push({ title: '总预算', data: [totalBudget] });
    if (categoryBudgets.length > 0) list.push({ title: '分类预算', data: categoryBudgets });
    return list;
  }, [totalBudget, categoryBudgets]);

  const onAdd = useCallback(() => {
    if (!totalBudget) {
      navigation.navigate('BudgetEdit', { budgetType: 'total' });
    } else {
      navigation.navigate('BudgetEdit', { budgetType: 'category', parentId: totalBudget.id });
    }
  }, [totalBudget, navigation]);

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!totalBudget && categoryBudgets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="wallet-outline" size={56} color="#ccc" />
        <Text style={styles.emptyTitle}>还没有预算</Text>
        <Text style={styles.emptyDesc}>先创建一个总预算，再为分类分配额度</Text>
        <Pressable style={styles.primaryButton} onPress={onAdd}>
          <Text style={styles.primaryText}>创建总预算</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderSectionHeader={({ section: { title } }) => <Text style={styles.header}>{title}</Text>}
        renderItem={({ item }) => {
          const spent = spentMap[item.id] || 0;
          const limit = getBudgetLimit(item);
          const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
          const widthPercent = Math.max(0, Math.min(100, percentage));
          const dangerThreshold = item.alert_threshold != null ? Number(item.alert_threshold) : 80;
          const barColor =
            percentage >= DEFAULT_ALERT_THRESHOLDS.OVER
              ? ALERT_COLORS.over
              : percentage >= dangerThreshold
                ? ALERT_COLORS.danger
                : percentage >= DEFAULT_ALERT_THRESHOLDS.WARNING
                  ? ALERT_COLORS.warning
                  : ALERT_COLORS.safe;
          const title = item.budget_type === 'total' ? '总预算' : (item.category || '未命名分类');
          const periodLabel = (PERIOD_LABELS as any)[item.period || 'monthly'] || '预算';

          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => navigation.navigate('BudgetEdit', { id: item.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons
                      name={item.budget_type === 'total' ? 'wallet' : 'tag-outline'}
                      size={20}
                      color={item.budget_type === 'total' ? theme.colors.primary : '#666'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.cardSubTitle}>{periodLabel}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.amountText}>{formatCurrency(spent)}</Text>
                <Text style={styles.amountDivider}>/</Text>
                <Text style={styles.amountText}>{formatCurrency(limit)}</Text>
                <Text style={styles.amountHint}>（剩余 {formatCurrency(Math.max(0, limit - spent))}）</Text>
              </View>

              <View style={styles.progressOuter}>
                <View style={[styles.progressInner, { width: `${widthPercent}%`, backgroundColor: barColor }]} />
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingBottom: 96 }}
      />

      <Pressable style={styles.fab} onPress={onAdd}>
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f0f0f0', fontSize: 13, color: '#666', fontWeight: '600' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 12, padding: 12 },
  cardPressed: { backgroundColor: '#fafafa' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  iconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  cardSubTitle: { fontSize: 12, color: '#999', marginTop: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap' },
  amountText: { fontSize: 14, fontWeight: '600', color: '#333' },
  amountDivider: { marginHorizontal: 4, color: '#999' },
  amountHint: { marginLeft: 6, fontSize: 12, color: '#999' },
  progressOuter: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  progressInner: { height: 8, borderRadius: 4 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '700', color: '#333' },
  emptyDesc: { marginTop: 8, fontSize: 13, color: '#999', textAlign: 'center' },
  primaryButton: { marginTop: 16, backgroundColor: theme.colors.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
