import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { api, getApiErrorMessage } from '../../../../shared/utils/api';
import type { AIAnalysisResult, AITransactionDraft } from '../../../../shared/types';
import { createLocalTransactions } from '../../storage/localDB';
import { enqueueMany } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AIAddScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<AITransactionDraft[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const total = useMemo(() => drafts.reduce((s, d) => s + (Number.isFinite(Number(d.amount)) ? Number(d.amount) : 0), 0), [drafts]);

  const updateDraft = (idx: number, patch: Partial<AITransactionDraft>) => {
    setDrafts(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeDraft = (idx: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== idx));
  };

  const onAnalyze = async () => {
    if (!user) return;
    const t = text.trim();
    if (!t) {
      Alert.alert('提示', '请输入要分析的文本');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<AIAnalysisResult>('/api/ai/analyze', { text: t });
      setDrafts(Array.isArray(res.transactions) ? res.transactions : []);
      setIgnored(Array.isArray(res.ignored) ? res.ignored : []);
      setWarnings(Array.isArray(res.warnings) ? res.warnings : []);
      if (!res.transactions || res.transactions.length === 0) {
        Alert.alert('结果', '未识别到有效交易');
      }
    } catch (err: unknown) {
      Alert.alert('分析失败', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onSaveAll = async () => {
    if (!user) return;
    if (drafts.length === 0) return;

    const items = drafts.map(d => ({
      type: d.type,
      category: String(d.category || '').trim(),
      amount: Number(d.amount),
      description: String(d.description || '').trim(),
      date: String(d.date || '').trim(),
    }));

    const invalid = items.find(it => !it.category || !Number.isFinite(it.amount) || it.amount <= 0);
    if (invalid) {
      Alert.alert('提示', '请检查分类与金额（金额必须为正数）');
      return;
    }

    setSaving(true);
    try {
      const created = await createLocalTransactions(user.id, items);
      await enqueueMany(user.id, 'transactions', 'upsert', created);
      Alert.alert('已保存', `已保存到本地（待同步）：${created.length} 条，合计 ${total.toFixed(2)}`);
      setDrafts([]);
      setIgnored([]);
      setWarnings([]);
      setText('');
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert('保存失败', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI 智能记账</Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        value={text}
        onChangeText={setText}
        placeholder="例如：今天买了咖啡30块，打车花了50，还有午饭80块"
        multiline
      />

      <Pressable style={[styles.primaryButton, loading ? styles.disabled : null]} onPress={onAnalyze} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>AI 智能分析</Text>}
      </Pressable>

      {warnings.length > 0 ? (
        <View style={styles.bannerWarn}>
          <Text style={styles.bannerTitle}>AI 提示</Text>
          {warnings.map((w, i) => (
            <Text key={i} style={styles.bannerText}>{w}</Text>
          ))}
        </View>
      ) : null}

      {ignored.length > 0 ? (
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>已忽略内容</Text>
          {ignored.map((s, i) => (
            <Text key={i} style={styles.bannerText}>{s}</Text>
          ))}
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
        {drafts.map((d, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>交易 {idx + 1}</Text>
              <Pressable onPress={() => removeDraft(idx)} accessibilityLabel="删除该条交易">
                <Text style={styles.deleteText}>删除</Text>
              </Pressable>
            </View>

            <View style={styles.segmentRow}>
              <Pressable
                style={[styles.segment, d.type === 'expense' ? styles.segmentActive : null]}
                onPress={() => updateDraft(idx, { type: 'expense' })}
                accessibilityLabel="选择支出类型"
              >
                <Text style={[styles.segmentText, d.type === 'expense' ? styles.segmentTextActive : null]}>支出</Text>
              </Pressable>
              <Pressable
                style={[styles.segment, d.type === 'income' ? styles.segmentActive : null]}
                onPress={() => updateDraft(idx, { type: 'income' })}
                accessibilityLabel="选择收入类型"
              >
                <Text style={[styles.segmentText, d.type === 'income' ? styles.segmentTextActive : null]}>收入</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              value={d.category}
              onChangeText={(v) => updateDraft(idx, { category: v })}
              placeholder="分类"
            />
            <TextInput
              style={styles.input}
              value={Number.isFinite(Number(d.amount)) ? String(d.amount) : ''}
              onChangeText={(v) => updateDraft(idx, { amount: Number(v) })}
              placeholder="金额"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              value={d.date}
              onChangeText={(v) => updateDraft(idx, { date: v })}
              placeholder="日期（YYYY-MM-DD）"
            />
            <TextInput
              style={[styles.input, styles.textAreaSmall]}
              value={d.description}
              onChangeText={(v) => updateDraft(idx, { description: v })}
              placeholder="备注"
              multiline
            />
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.primaryButton, (saving || drafts.length === 0) ? styles.disabled : null]}
        onPress={onSaveAll}
        disabled={saving || drafts.length === 0}
        accessibilityLabel="保存全部交易到本地队列"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>全部保存（离线队列）</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  textArea: { height: 110, textAlignVertical: 'top' },
  textAreaSmall: { height: 70, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#667eea', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  bannerWarn: { backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#ffd591', borderRadius: 10, padding: 12, marginTop: 12 },
  bannerInfo: { backgroundColor: '#e6f7ff', borderWidth: 1, borderColor: '#91d5ff', borderRadius: 10, padding: 12, marginTop: 12 },
  bannerTitle: { fontWeight: '700', marginBottom: 6, color: '#333' },
  bannerText: { color: '#333', marginBottom: 2 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, marginTop: 12, backgroundColor: '#fafafa' },
  cardTitle: { fontWeight: '700', color: '#333' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteText: { color: '#f5222d', fontWeight: '600' },
  segmentRow: { flexDirection: 'row', marginTop: 10 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  segmentActive: { backgroundColor: '#667eea', borderColor: '#667eea' },
  segmentText: { color: '#333', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
});
