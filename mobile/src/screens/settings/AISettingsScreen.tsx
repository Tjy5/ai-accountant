import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { api, getApiErrorMessage } from '../../../../shared/utils/api';
import type { AISettings, AISettingsResponse } from '../../../../shared/types';

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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.title}>AI 设置</Text>

      <View style={styles.rowBetween}>
        <Text style={styles.label}>启用 AI</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>

      <Text style={styles.label}>API Base URL</Text>
      <TextInput
        style={styles.input}
        value={apiBaseUrl}
        onChangeText={setApiBaseUrl}
        placeholder="https://api.openai.com/v1"
        autoCapitalize="none"
      />

      <Text style={styles.label}>API Key</Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder={apiKeyPlaceholder}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.label}>模型</Text>
      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder="gpt-3.5-turbo"
        autoCapitalize="none"
      />

      <Text style={styles.label}>temperature (0-2)</Text>
      <TextInput
        style={styles.input}
        value={temperature}
        onChangeText={setTemperature}
        placeholder="0.7"
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>maxTokens</Text>
      <TextInput
        style={styles.input}
        value={maxTokens}
        onChangeText={setMaxTokens}
        placeholder="1000"
        keyboardType="number-pad"
      />

      <Pressable style={[styles.primaryButton, saving ? styles.disabled : null]} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>保存</Text>}
      </Pressable>
      <Pressable style={[styles.dangerButton, saving ? styles.disabled : null]} onPress={onClear} disabled={saving}>
        <Text style={styles.dangerText}>清除配置并禁用</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 6, color: '#333', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  primaryButton: { backgroundColor: '#667eea', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dangerButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ffccc7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  dangerText: { color: '#f5222d', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
