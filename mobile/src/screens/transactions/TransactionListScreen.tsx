import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, SectionList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { listTransactions, softDeleteLocalTransaction, type TransactionRecord } from '../../storage/localDB';
import { syncNow, enqueue } from '../../sync/offlineQueue';
import { theme } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/ScreenContainer';
import { WealthCard } from '../../components/WealthCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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

  const { sections, totalIncome, totalExpense } = useMemo(() => {
    const grouped: Record<string, { data: TransactionRecord[], income: number, expense: number }> = {};
    let tIncome = 0;
    let tExpense = 0;

    items.forEach(item => {
      const dateObj = new Date(item.date.replace(' ', 'T'));
      // Manual formatting for consistent Chinese date
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
      setSyncError(null);
      load().catch(() => undefined).finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    setSyncError(null);
    try {
      await syncNow(user.id);
      await load();
    } catch (err: any) {
      // Error handling
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

  const renderTransactionItem = ({ item, index, section }: { item: TransactionRecord, index: number, section: any }) => {
    const isFirst = index === 0;
    const isLast = index === section.data.length - 1;
    const isIncome = item.type === 'income';
    const amountColor = isIncome ? '#059669' : '#1E293B';
    const iconColor = isIncome ? '#059669' : '#475569';
    const iconBg = isIncome ? '#ECFDF5' : '#F1F5F9';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.itemContainer,
          isFirst && styles.itemFirst,
          isLast && styles.itemLast,
          pressed && styles.itemPressed,
          !isLast && styles.itemBorder
        ]}
        onPress={() => navigation.navigate('TransactionEdit', { id: item.id } as any)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons
            name={isIncome ? 'arrow-down' : 'cart-outline'}
            size={22}
            color={iconColor}
          />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemRow}>
            <AppText variant="body" bold style={{ fontSize: 15, color: theme.colors.textPrimary }}>{item.category}</AppText>
            <AppText variant="body" bold style={{ fontSize: 16, color: amountColor }}>
              {item.type === 'expense' ? '-' : '+'}
              {Number(item.amount).toFixed(2)}
            </AppText>
          </View>
          {(item.description && item.description.trim() !== '') ? (
            <AppText variant="caption" numberOfLines={1} style={{ marginTop: 2, color: theme.colors.textSecondary }}>
              {item.description}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderHeaderContent = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    return (
      <View style={styles.headerContentWrapper}>
        <View style={styles.headerRow}>
          {/* Left: Date Info */}
          <View>
            <AppText style={styles.headerYear}>{currentYear}年</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <AppText style={styles.headerMonth}>{currentMonth}</AppText>
              <AppText style={styles.headerMonthLabel}>月</AppText>
              <MaterialCommunityIcons name="chevron-down" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
            </View>
          </View>

          {/* Right: Stats */}
          <View style={styles.headerStats}>
            <View style={styles.statLine}>
              <AppText style={styles.statLabel}>收入</AppText>
              <AppText style={styles.statValueIncome}>+{totalIncome.toFixed(2)}</AppText>
            </View>
            <View style={[styles.statLine, { marginTop: 4 }]}>
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
      headerType="standard"
      headerContent={renderHeaderContent()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F172A']} tintColor="#0F172A" />}
      enableScroll={false}
      useSafeBottom={false}
    >
      <SectionList
        style={{ marginTop: 20 }}
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={renderTransactionItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <AppText variant="caption" bold style={styles.dateText}>{title}</AppText>
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: 16 }} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={theme.colors.textMuted} />
            <AppText variant="body" color={theme.colors.textSecondary} style={{ marginTop: 16 }}>
              暂无记录，下拉同步或新增一笔
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerYear: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  headerMonth: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 38,
  },
  headerMonthLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 2,
    fontWeight: '500',
  },
  headerStats: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginRight: 8,
  },
  statValueIncome: {
    color: '#6EE7B7', // Emerald 300
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statValueExpense: {
    color: '#FFF',
    fontSize: 15,
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
    marginTop: 80,
    opacity: 0.5,
  },
  sectionHeader: {
    marginBottom: 8,
    marginLeft: 8,
  },
  dateText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: theme.colors.surface,
  },
  itemFirst: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  itemLast: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  itemPressed: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  itemContent: { flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
