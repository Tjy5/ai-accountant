import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { getPendingCount, syncNow } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { theme } from '../../theme';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card/Card';

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
    <ScreenWrapper>
      <View style={styles.container}>
        <AppText variant="title" bold style={styles.header}>设置</AppText>

        <Card style={styles.profileCard}>
          <View style={styles.profileContent}>
            <View style={styles.avatar}>
              <AppText variant="header" color="#fff" bold>{user.email?.[0]?.toUpperCase()}</AppText>
            </View>
            <View>
              <AppText variant="title" bold>{user.email}</AppText>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: theme.colors.wealth.success }]} />
                <AppText variant="caption">已登录</AppText>
              </View>
            </View>
          </View>
        </Card>

        <AppText variant="caption" bold style={styles.sectionTitle}>同步</AppText>
        <Card style={styles.menuCard} noPadding>
          <View style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={24} color={theme.colors.primary} />
              <AppText style={{ marginLeft: 16, fontSize: 16 }}>待同步操作</AppText>
            </View>
            <View style={styles.menuRight}>
              {pending > 0 && (
                <View style={styles.badge}>
                  <AppText variant="caption" color="#fff" bold>{String(pending)}</AppText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={onSync}
            disabled={syncing}
          >
            <View style={styles.menuLeft}>
              {syncing ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <MaterialCommunityIcons name="refresh" size={24} color={theme.colors.primary} />}
              <AppText style={{ marginLeft: 16, fontSize: 16 }} color={syncing ? theme.colors.textSecondary : theme.colors.textPrimary}>
                {syncing ? '正在同步...' : '立即同步'}
              </AppText>
            </View>
          </Pressable>
        </Card>

        {syncError && <AppText color={theme.colors.error} style={styles.message}>{syncError}</AppText>}
        {syncSuccess && <AppText color={theme.colors.wealth.success} style={styles.message}>{syncSuccess}</AppText>}

        <AppText variant="caption" bold style={styles.sectionTitle}>功能</AppText>
        <Card style={styles.menuCard} noPadding>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AISettings')}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons name="robot-outline" size={24} color={theme.colors.secondary} />
              <AppText style={{ marginLeft: 16, fontSize: 16 }}>AI 设置</AppText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AIChat')}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons name="chat-processing-outline" size={24} color={theme.colors.primary} />
              <AppText style={{ marginLeft: 16, fontSize: 16 }}>AI 聊天记账</AppText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate('CategoryList')}
          >
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons name="tag-outline" size={24} color={theme.colors.secondary} />
              <AppText style={{ marginLeft: 16, fontSize: 16 }}>分类管理</AppText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} />
          </Pressable>
        </Card>

        <Pressable style={styles.logoutBtn} onPress={signOut}>
          <AppText color={theme.colors.error} bold>退出登录</AppText>
        </Pressable>

      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  profileCard: { marginBottom: 16 },
  profileContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  sectionTitle: { marginBottom: 12, marginLeft: 8, color: theme.colors.textSecondary, fontSize: 13 },
  menuCard: { marginBottom: 24, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  pressed: { backgroundColor: theme.colors.surfaceVariant },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuRight: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: theme.colors.surfaceVariant, marginLeft: 60 },

  badge: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8
  },

  message: { textAlign: 'center', marginBottom: 12 },

  logoutBtn: {
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 20, // Match Card radius
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
    marginTop: 10
  }
});
