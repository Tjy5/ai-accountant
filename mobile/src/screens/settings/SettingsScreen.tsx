import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { getPendingCount, syncNow } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    if (!user) return;
    const n = await getPendingCount(user.id);
    setPending(n);
  }, [user]);

  useEffect(() => {
    refreshPending().catch(() => undefined);
  }, [refreshPending]);

  const onSync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      await syncNow(user.id);
      await refreshPending();
      setSyncSuccess('同步成功！');
      setTimeout(() => setSyncSuccess(null), 3000);
    } catch (err: any) {
      const message = err?.message || '同步失败';
      if (message.includes('Network') || message.includes('network') || message.includes('fetch')) {
        setSyncError('网络连接失败，请检查网络后重试');
      } else if (message.includes('401') || message.includes('Unauthorized')) {
        setSyncError('登录已过期，请重新登录');
      } else {
        setSyncError(`同步失败: ${message}`);
      }
    } finally {
      setSyncing(false);
    }
  }, [user, refreshPending]);

  if (!user) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>账号</Text>
      <Text style={styles.item}>Email: {user.email}</Text>
      <Text style={styles.item}>待同步操作: {pending}</Text>

      <Pressable
        style={styles.menuItem}
        onPress={() => navigation.navigate('AISettings')}
        accessibilityLabel="AI 设置"
      >
        <Text style={styles.menuText}>AI 设置</Text>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </Pressable>

      <Pressable
        style={styles.menuItem}
        onPress={() => navigation.navigate('CategoryList')}
        accessibilityLabel="分类管理"
      >
        <Text style={styles.menuText}>分类管理</Text>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </Pressable>

      {syncError ? (
        <Pressable style={styles.errorBanner} onPress={() => setSyncError(null)}>
          <Text style={styles.errorText}>{syncError}</Text>
          <Text style={styles.errorClose}>×</Text>
        </Pressable>
      ) : null}
      {syncSuccess ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{syncSuccess}</Text>
        </View>
      ) : null}
      <Pressable style={styles.primaryButton} onPress={onSync} disabled={syncing} accessibilityLabel="立即同步">
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>立即同步</Text>}
      </Pressable>
      <Pressable style={styles.dangerButton} onPress={signOut} accessibilityLabel="退出登录">
        <Text style={styles.dangerText}>退出登录</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  item: { marginBottom: 8, color: '#333' },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    marginTop: 8
  },
  menuText: { fontSize: 16, color: '#333' },
  errorBanner: { backgroundColor: '#fff2f0', borderWidth: 1, borderColor: '#ffccc7', borderRadius: 8, padding: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#f5222d', fontSize: 14, flex: 1 },
  errorClose: { color: '#f5222d', fontSize: 20, fontWeight: '600', marginLeft: 8 },
  successBanner: { backgroundColor: '#f6ffed', borderWidth: 1, borderColor: '#b7eb8f', borderRadius: 8, padding: 12, marginTop: 8 },
  successText: { color: '#52c41a', fontSize: 14 },
  primaryButton: { backgroundColor: '#667eea', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dangerButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffccc7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  dangerText: { color: '#f5222d', fontSize: 16, fontWeight: '600' },
});

