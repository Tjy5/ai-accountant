import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { getPendingCount, syncNow } from '../../sync/offlineQueue';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

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
    try {
      await syncNow(user.id);
      await refreshPending();
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
      <Pressable style={styles.primaryButton} onPress={onSync} disabled={syncing}>
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>立即同步</Text>}
      </Pressable>
      <Pressable style={styles.dangerButton} onPress={signOut}>
        <Text style={styles.dangerText}>退出登录</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  item: { marginBottom: 8, color: '#333' },
  primaryButton: { backgroundColor: '#667eea', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dangerButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffccc7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  dangerText: { color: '#f5222d', fontSize: 16, fontWeight: '600' },
});
