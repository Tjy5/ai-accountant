import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { ActivityIndicator, Alert, SectionList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import {
  listTransactions,
  softDeleteLocalTransaction,
  getDashboardStats,
  getHudBudgetStatus,
  onDBEvent,
  type TransactionRecord,
  type HudBudgetStatus,
} from '../../storage/localDB';
import { syncNow, enqueue } from '../../sync/offlineQueue';
import { theme } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card/Card';
import { BudgetProgressBar } from '../../components/BudgetProgressBar';
import { TodayExpenseDisplay } from '../../components/TodayExpenseDisplay';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<HudBudgetStatus | null>(null);
  const [todayExpense, setTodayExpense] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await listTransactions(user.id);
      rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setItems(rows);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
    }
  }, [user]);

  const loadHUD = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const [budget, stats] = await Promise.all([
      getHudBudgetStatus(user.id),
      getDashboardStats(user.id, todayStr, todayStr),
    ]);
    setBudgetStatus(budget);
    setTodayExpense(stats.expense);
  }, [user]);

  const { sections, totalIncome, totalExpense } = useMemo(() => {
    const grouped: Record<string, { data: TransactionRecord[], income: number, expense: number }> = {};
    let tIncome = 0;
    let tExpense = 0;

    items.forEach(item => {
      const dateObj = new Date(item.date.replace(' ', 'T'));
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const weekDayDict = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const weekDay = weekDayDict[dateObj.getDay()];
      const dateKey = `${month}月${day}日 ${weekDay}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = { data: [], income: 0, expense: 0 };
      }

      grouped[dateKey].data.push(item);
      if (item.type === 'income') {
        grouped[dateKey].income += item.amount;
        tIncome += item.amount;
      }
      else {
        grouped[dateKey].expense += item.amount;
        tExpense += item.amount;
      }
    });

    const resultSections = Object.entries(grouped).map(([title, { data, income, expense }]) => ({
      title,
      data,
      income,
      expense
    }));
    return { sections: resultSections, totalIncome: tIncome, totalExpense: tExpense };
  }, [items]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([load(), loadHUD()])
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, [load, loadHUD])
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const unsub = onDBEvent('transactionsChanged', () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        load();
        loadHUD();
      }, 200);
    });
    return () => {
      unsub();
      clearTimeout(timeoutId);
    };
  }, [load, loadHUD]);

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await syncNow(user.id);
      await load();
    } catch (err: any) {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [user, load]);

  const handleDelete = (item: TransactionRecord) => {
    Alert.alert(
      '删除记录',
      `确定要删除 ${item.category} ¥${item.amount} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              const deletedAt = await softDeleteLocalTransaction(user.id, item.id);
              await enqueue(user.id, 'transactions', 'upsert', { id: item.id, deleted_at: deletedAt, updated_at: deletedAt });
              setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (e) {
              Alert.alert('删除失败', '请重试');
            }
          }
        }
      ]
    );
  };

  const renderTransactionItem = ({ item }: { item: TransactionRecord }) => {
    const isIncome = item.type === 'income';
    const amountColor = isIncome ? theme.colors.wealth.functional.income : theme.colors.textPrimary;
    const iconColor = isIncome ? theme.colors.wealth.functional.income : theme.colors.textSecondary;
    const iconBg = isIncome ? 'rgba(16, 185, 129, 0.1)' : 'rgba(241, 245, 249, 1)';

    return (
      <Card
        onPress={() => navigation.navigate('TransactionEdit', { id: item.id } as any)}
        style={{ marginBottom: 16, marginHorizontal: 4, overflow: 'hidden' }}
        noPadding
      >
        <Pressable
          onLongPress={() => handleDelete(item)}
          onPress={() => navigation.navigate('TransactionEdit', { id: item.id } as any)}
          style={{ padding: 20, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons
              name={isIncome ? 'arrow-bottom-left' : 'cart-outline'}
              size={24}
              color={iconColor}
              style={{ opacity: 0.9 }}
            />
          </View>
          <View style={styles.itemContent}>
            <View style={styles.itemRow}>
              <AppText variant="body" bold style={{ fontSize: 16, color: theme.colors.textPrimary }}>{item.category}</AppText>
              <AppText variant="body" bold style={{ fontSize: 18, color: amountColor, fontWeight: '700' }}>
                {item.type === 'expense' ? '-' : '+'}
                {Number(item.amount).toFixed(2)}
              </AppText>
            </View>
            {(item.description && item.description.trim() !== '') ? (
              <AppText variant="caption" numberOfLines={1} style={{ marginTop: 6, color: theme.colors.textSecondary }}>
                {item.description}
              </AppText>
            ) : (
              <View style={{ marginTop: 4 }} />
            )}
          </View>
        </Pressable>
      </Card>
    );
  };

  const renderHeaderContent = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    return (
      <View style={styles.headerContentWrapper}>
        {/* HUD: Budget Progress Bar */}
        {budgetStatus?.hasBudget ? (
          <View style={styles.hudProgressSection}>
            <View style={styles.hudProgressHeader}>
              <AppText style={styles.hudProgressLabel}>本月预算</AppText>
              <AppText style={styles.hudProgressPercent}>
                {Math.round(budgetStatus.percentage)}%
              </AppText>
            </View>
            <BudgetProgressBar percentage={budgetStatus.percentage} animated />
            <View style={styles.hudProgressFooter}>
              <AppText style={styles.hudProgressSpent}>
                ¥{budgetStatus.spent.toFixed(0)}
              </AppText>
              <AppText style={styles.hudProgressLimit}>
                / ¥{budgetStatus.limit.toFixed(0)}
              </AppText>
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.hudNoBudget}
            onPress={() => navigation.navigate('Budget' as any)}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="wallet-plus-outline" size={20} color="rgba(255,255,255,0.9)" />
            </View>
            <AppText style={styles.hudNoBudgetText}>设立预算</AppText>
          </Pressable>
        )}

        {/* HUD: Today Expense Display */}
        <TodayExpenseDisplay amount={todayExpense} animated style={styles.hudExpense} />

        {/* Monthly Stats Row */}
        <View style={styles.headerRow}>
          <View>
            <AppText style={styles.headerYear}>{currentYear}年</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <AppText style={styles.headerMonth}>{currentMonth}</AppText>
              <AppText style={styles.headerMonthLabel}>月</AppText>
            </View>
          </View>

          <View style={styles.headerStats}>
            <View style={styles.statLine}>
              <AppText style={styles.statLabel}>收入</AppText>
              <AppText style={styles.statValueIncome}>+{totalIncome.toFixed(2)}</AppText>
            </View>
            <View style={[styles.statLine, { marginTop: 6 }]}>
              <AppText style={styles.statLabel}>支出</AppText>
              <AppText style={styles.statValueExpense}>{totalExpense.toFixed(2)}</AppText>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScreenContainer
      headerType="jumbo"
      headerContent={renderHeaderContent()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
      enableScroll={false}
      useSafeBottom={false}
      headerGradientColors={theme.colors.wealth.gradients.header}
    >
      <SectionList
        style={{ marginTop: 24 }}
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={renderTransactionItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <AppText variant="caption" bold style={styles.dateText}>{title}</AppText>
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: 8 }} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="playlist-edit" size={64} color={theme.colors.textMuted} />
            <AppText variant="body" color={theme.colors.textSecondary} style={{ marginTop: 16 }}>
              暂无记录，开启新的一天
            </AppText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerContentWrapper: {
    paddingTop: 10,
    paddingHorizontal: 4,
    flex: 1,
    justifyContent: 'space-between',
  },
  hudProgressSection: {
    marginBottom: 16,
  },
  hudProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hudProgressLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  hudProgressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hudProgressFooter: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'flex-end',
    alignItems: 'baseline',
  },
  hudProgressSpent: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  hudProgressLimit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 2,
  },
  hudNoBudget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  hudNoBudgetText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
    fontWeight: '600'
  },
  iconCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center'
  },
  hudExpense: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  headerYear: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 2,
  },
  headerMonth: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 46,
    letterSpacing: -1,
  },
  headerMonthLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
    marginBottom: 6,
    fontWeight: '500',
  },
  headerStats: {
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginRight: 10,
  },
  statValueIncome: {
    color: '#6EE7B7', // Emerald 300
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statValueExpense: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
    opacity: 0.6,
  },
  sectionHeader: {
    marginBottom: 12,
    marginLeft: 8,
    marginTop: 8,
  },
  dateText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemContent: { flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
