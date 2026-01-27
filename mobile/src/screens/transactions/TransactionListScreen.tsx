import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View, StatusBar } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { listTransactions, softDeleteLocalTransaction, type TransactionRecord } from '../../storage/localDB';
import { syncNow, enqueue } from '../../sync/offlineQueue';
import { theme } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AppText } from '../../components/AppText';
import { AppCard } from '../../components/AppCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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

  // Header logic moved to main render


  const renderTransactionItem = (item: TransactionRecord, isLast: boolean) => {
    const isIncome = item.type === 'income';
    const amountColor = isIncome ? '#059669' : '#1E293B'; // Emerald 600 or Slate 800
    const iconColor = isIncome ? '#059669' : '#475569'; // Emerald 600 or Slate 600
    const iconBg = isIncome ? '#ECFDF5' : '#F1F5F9'; // Emerald 50 or Slate 100

    return (
      <Pressable
        key={item.id}
        style={({ pressed }) => [
          styles.itemContainer,
          pressed && styles.itemPressed,
          !isLast && styles.itemBorder
        ]}
        onPress={() => navigation.navigate('TransactionEdit', { id: item.id })}
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

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Clean Professional Header */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']} // Premium Midnight Slate
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientHeader, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.headerContent}>
            <AppText style={styles.headerLabel}>本月支出</AppText>
            <View style={styles.headerBalanceRow}>
              <AppText style={styles.headerSymbol}>¥</AppText>
              <AppText style={styles.headerAmount}>{totalExpense.toFixed(2)}</AppText>
            </View>

            <View style={styles.statRow}>
              <View style={styles.incomeBadge}>
                <Ionicons name="arrow-down-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
                <AppText style={styles.incomeLabel}>本月收入</AppText>
                <AppText style={styles.incomeValue}>+¥{totalIncome.toFixed(2)}</AppText>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.title}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0F172A']} tintColor="#0F172A" />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: section }) => (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <AppText variant="caption" bold style={styles.dateText}>{section.title}</AppText>
            </View>

            <AppCard padding="none" style={styles.card}>
              {section.data.map((transaction, index) =>
                renderTransactionItem(transaction, index === section.data.length - 1)
              )}
            </AppCard>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={theme.colors.textMuted} />
            <AppText variant="body" color={theme.colors.textSecondary} style={{ marginTop: 16 }}>
              暂无记录，下拉同步或新增一笔
            </AppText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  gradientHeader: {
    paddingHorizontal: 24,
    paddingTop: 0, // Padding handled by insets in render
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  headerWrapper: {
    zIndex: 1,
  },
  headerContent: {
    position: 'relative',
    zIndex: 10,
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  headerSymbol: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFF',
    marginRight: 6,
    opacity: 0.9,
  },
  headerAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  statRow: {
    flexDirection: 'row',
  },
  incomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  incomeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginRight: 8,
  },
  incomeValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 100
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
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  dateText: {
    color: '#94A3B8', // Slate 400
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, // Softer shadow
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 0, // Removed border for cleaner look
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
  },
  itemPressed: {
    backgroundColor: '#F8FAFC'
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 24, // Slightly larger, fully round
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16
  },
  itemContent: { flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
