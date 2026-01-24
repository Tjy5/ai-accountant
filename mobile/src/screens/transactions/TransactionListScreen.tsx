import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, SectionList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { listTransactions, softDeleteLocalTransaction, type TransactionRecord } from '../../storage/localDB';
import { syncNow, enqueue } from '../../sync/offlineQueue';
import { theme } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

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

  const sections = useMemo(() => {
    const grouped: Record<string, { data: TransactionRecord[], income: number, expense: number }> = {};

    items.forEach(item => {
      const dateObj = new Date(item.date.replace(' ', 'T'));
      const dateKey = dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric', weekday: 'short' });

      if (!grouped[dateKey]) {
        grouped[dateKey] = { data: [], income: 0, expense: 0 };
      }

      grouped[dateKey].data.push(item);
      if (item.type === 'income') grouped[dateKey].income += item.amount;
      else grouped[dateKey].expense += item.amount;
    });

    return Object.entries(grouped).map(([title, { data, income, expense }]) => ({
      title,
      data,
      income,
      expense
    }));
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
      const message = err?.message || '同步失败';
      if (message.includes('Network') || message.includes('network') || message.includes('fetch')) {
        setSyncError('网络连接失败，请检查网络后重试');
      } else if (message.includes('401') || message.includes('Unauthorized')) {
        setSyncError('登录已过期，请重新登录');
      } else {
        setSyncError(`同步失败: ${message}`);
      }
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [user, load]);

  const handleDelete = useCallback((item: TransactionRecord) => {
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
              await enqueue(user.id, 'transactions', 'upsert', {
                id: item.id,
                deleted_at: deletedAt,
                updated_at: deletedAt
              });
              setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (e) {
              Alert.alert('删除失败', '请重试');
            }
          }
        }
      ]
    );
  }, [user]);

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
      {syncError ? (
        <Pressable style={styles.errorBanner} onPress={() => setSyncError(null)}>
          <Text style={styles.errorText}>{syncError}</Text>
          <Text style={styles.errorClose}>×</Text>
        </Pressable>
      ) : null}
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section: { title, income, expense } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionSummary}>
              {income > 0 && <Text style={styles.summaryIncome}>收 ¥{income.toFixed(2)}</Text>}
              {expense > 0 && <Text style={styles.summaryExpense}>支 ¥{expense.toFixed(2)}</Text>}
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('TransactionEdit', { id: item.id })}
            onLongPress={() => handleDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.category}, ${item.type === 'income' ? '收入' : '支出'} ${item.amount}元`}
            accessibilityHint="点击编辑，长按删除"
          >
            <View style={styles.cardLeft}>
              <View style={[styles.iconBox, { backgroundColor: item.type === 'income' ? theme.colors.success + '20' : theme.colors.error + '20' }]}>
                <MaterialCommunityIcons
                  name={item.type === 'income' ? 'arrow-down' : 'cart-outline'}
                  size={20}
                  color={item.type === 'income' ? theme.colors.success : theme.colors.error}
                />
              </View>
              <View style={styles.contentBox}>
                <Text style={styles.category}>{item.category}</Text>
                {item.description ? <Text style={styles.desc} numberOfLines={1}>{item.description}</Text> : null}
              </View>
            </View>
            <View style={styles.amountBox}>
              <Text style={[styles.amount, item.type === 'expense' ? styles.expense : styles.income]}>
                {item.type === 'expense' ? '-' : '+'}
                {Number(item.amount).toFixed(2)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#ccc" />
            <Text style={styles.empty}>暂无记录，下拉同步或新增一笔</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  empty: { marginTop: 16, color: '#999', fontSize: 14 },
  errorBanner: { backgroundColor: '#fff2f0', borderWidth: 1, borderColor: '#ffccc7', borderRadius: 8, padding: 12, marginHorizontal: 12, marginTop: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#f5222d', fontSize: 14, flex: 1 },
  errorClose: { color: '#f5222d', fontSize: 20, fontWeight: '600', marginLeft: 8 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  sectionTitle: { fontSize: 13, color: '#666', fontWeight: '500' },
  sectionSummary: { flexDirection: 'row', gap: 12 },
  summaryIncome: { fontSize: 12, color: theme.colors.success },
  summaryExpense: { fontSize: 12, color: theme.colors.error },

  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0'
  },
  cardPressed: { backgroundColor: '#fafafa' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },

  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12
  },
  contentBox: { flex: 1, justifyContent: 'center' },
  category: { fontSize: 15, fontWeight: '500', color: '#333', marginBottom: 2 },
  desc: { fontSize: 12, color: '#999' },

  amountBox: { alignItems: 'flex-end', minWidth: 80 },
  amount: { fontSize: 16, fontWeight: '600' },
  expense: { color: theme.colors.error },
  income: { color: theme.colors.success },
});
