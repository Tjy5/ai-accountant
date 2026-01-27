import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { api, getApiErrorMessage } from '../../../../shared/utils/api';
import type { AISettings, AISettingsResponse } from '../../../../shared/types';
import { theme } from '../../theme';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppText } from '../../components/AppText';
import { AppCard } from '../../components/AppCard';

export default function AISettingsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [temperature, setTemperature] = useState('0.7');
  const [maxTokens, setMaxTokens] = useState('1000');
  const [enabled, setEnabled] = useState(false);

  const apiKeyPlaceholder = useMemo(() => {
    if (hasSavedKey) return '已配置（********），如需修改请重新输入';
    return '请输入 API Key';
  }, [hasSavedKey]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resp = await api.get<AISettingsResponse>('/api/ai/settings');
      const s: AISettings = resp.settings;
      setApiBaseUrl(s.apiBaseUrl || 'https://api.openai.com/v1');
      setModel(s.model || 'gpt-3.5-turbo');
      setTemperature(String(Number.isFinite(Number(s.temperature)) ? s.temperature : 0.7));
      setMaxTokens(String(Number.isFinite(Number(s.maxTokens)) ? s.maxTokens : 1000));
      setEnabled(Boolean(s.enabled));
      setHasSavedKey(s.apiKey === '********');
      setApiKey('');
    } catch (err: unknown) {
      Alert.alert('加载失败', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: any = {
        apiBaseUrl: apiBaseUrl.trim(),
        model: model.trim(),
        temperature: Number(temperature),
        maxTokens: Number(maxTokens),
        enabled: Boolean(enabled),
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      await api.put('/api/ai/settings', payload);
      Alert.alert('已保存', 'AI 设置已保存');
      await load();
    } catch (err: unknown) {
      Alert.alert('保存失败', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.delete('/api/ai/settings');
      Alert.alert('已清除', '已清除 AI 配置（已禁用）');
      await load();
    } catch (err: unknown) {
      Alert.alert('清除失败', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <AppText variant="title" bold style={styles.header}>AI 配置</AppText>

        <AppCard style={styles.card}>
          <View style={styles.rowBetween}>
            <AppText bold>启用 AI 功能</AppText>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: theme.colors.outline, true: theme.colors.primary }}
            />
          </View>
        </AppCard>

        <AppText variant="caption" bold style={styles.sectionTitle}>连接设置</AppText>
        <AppCard style={styles.card}>
          <View style={styles.inputGroup}>
            <AppText variant="caption" color={theme.colors.textSecondary}>API Base URL</AppText>
            <TextInput
              style={styles.input}
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              placeholder="https://api.openai.com/v1"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputGroup}>
            <AppText variant="caption" color={theme.colors.textSecondary}>API Key</AppText>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder={apiKeyPlaceholder}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputGroup}>
            <AppText variant="caption" color={theme.colors.textSecondary}>Model</AppText>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={setModel}
              placeholder="gpt-3.5-turbo"
              autoCapitalize="none"
            />
          </View>
        </AppCard>

        <AppText variant="caption" bold style={styles.sectionTitle}>参数微调</AppText>
        <AppCard style={styles.card}>
          <View style={styles.inputGroup}>
            <AppText variant="caption" color={theme.colors.textSecondary}>Temperature (0-2)</AppText>
            <TextInput
              style={styles.input}
              value={temperature}
              onChangeText={setTemperature}
              placeholder="0.7"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputGroup}>
            <AppText variant="caption" color={theme.colors.textSecondary}>Max Tokens</AppText>
            <TextInput
              style={styles.input}
              value={maxTokens}
              onChangeText={setMaxTokens}
              placeholder="1000"
              keyboardType="number-pad"
            />
          </View>
        </AppCard>

        <Pressable
          style={[styles.primaryButton, saving ? styles.disabled : null]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" bold>保存配置</AppText>}
        </Pressable>

        <Pressable
          style={[styles.dangerButton, saving ? styles.disabled : null]}
          onPress={onClear}
          disabled={saving}
        >
          <AppText color={theme.colors.error}>清除配置并禁用</AppText>
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 20 },
  card: { marginBottom: 20 },
  sectionTitle: { marginBottom: 8, marginLeft: 4, color: theme.colors.textSecondary },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },

  inputGroup: { paddingVertical: 12 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    fontSize: 16,
    paddingVertical: 4,
    marginTop: 4,
    color: theme.colors.textPrimary
  },
  divider: { height: 1, backgroundColor: theme.colors.surfaceVariant },

  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
    ...theme.shadows.medium
  },

  dangerButton: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
    backgroundColor: theme.colors.surface
  },

  disabled: { opacity: 0.6 },
});
