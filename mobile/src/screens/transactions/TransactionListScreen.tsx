import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { listTransactions, type TransactionRecord } from '../../storage/localDB';
import { syncNow } from '../../sync/offlineQueue';

export default function TransactionListScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await listTransactions(user.id);
      setItems(rows);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
    }
  }, [user]);

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
      // Still load local data even if sync fails
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [user, load]);

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.center} accessibilityLabel="加载中">
        <ActivityIndicator size="large" accessibilityLabel="正在加载交易记录" />
      </View>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="交易记录列表">
      {syncError ? (
        <Pressable style={styles.errorBanner} onPress={() => setSyncError(null)} accessibilityLabel="点击关闭错误提示">
          <Text style={styles.errorText}>{syncError}</Text>
          <Text style={styles.errorClose}>×</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(it) => `${it.id}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            accessibilityLabel="下拉刷新同步"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            accessibilityLabel={`${item.type === 'expense' ? '支出' : '收入'} ${item.category} ${Number(item.amount).toFixed(2)} 元`}
            accessibilityRole="button"
          >
            <View style={styles.row}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={[styles.amount, item.type === 'expense' ? styles.expense : styles.income]}>
                {item.type === 'expense' ? '-' : '+'}
                {Number(item.amount).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.meta}>{formatDate(item.date)}</Text>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty} accessibilityLabel="暂无交易记录">
            暂无记录，下拉同步或新增一笔。
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 24, color: '#666' },
  errorBanner: { backgroundColor: '#fff2f0', borderWidth: 1, borderColor: '#ffccc7', borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#f5222d', fontSize: 14, flex: 1 },
  errorClose: { color: '#f5222d', fontSize: 20, fontWeight: '600', marginLeft: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700' },
  expense: { color: '#f5222d' },
  income: { color: '#52c41a' },
  meta: { marginTop: 6, color: '#666', fontSize: 12 },
  desc: { marginTop: 6, color: '#333', fontSize: 14 },
});
