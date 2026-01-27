import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { api, getApiErrorMessage } from '../../../../shared/utils/api';
import type { AIAnalysisResult, AITransactionDraft } from '../../../../shared/types';
import { createLocalTransactions } from '../../storage/localDB';
import { enqueueMany } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { theme } from '../../theme';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppText } from '../../components/AppText';
import { AppCard } from '../../components/AppCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppCard>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            placeholder="例如：今天买了咖啡30块，打车花了50，还有午饭80块"
            multiline
            placeholderTextColor={theme.colors.textSecondary + '80'}
          />
        </AppCard>

        <Pressable style={[styles.primaryButton, loading ? styles.disabled : null]} onPress={onAnalyze} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" bold>AI 智能分析</AppText>}
        </Pressable>

        {warnings.length > 0 && (
          <View style={styles.bannerWarn}>
            <AppText bold color="#856404" style={{ marginBottom: 6 }}>AI 提示</AppText>
            {warnings.map((w, i) => (
              <AppText key={i} variant="caption" color="#856404" style={{ marginBottom: 2 }}>• {w}</AppText>
            ))}
          </View>
        )}

        {ignored.length > 0 && (
          <View style={styles.bannerInfo}>
            <AppText bold color="#0c5460" style={{ marginBottom: 6 }}>已忽略内容</AppText>
            {ignored.map((s, i) => (
              <AppText key={i} variant="caption" color="#0c5460" style={{ marginBottom: 2 }}>• {s}</AppText>
            ))}
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          {drafts.map((d, idx) => (
            <AppCard key={idx} style={{ marginBottom: 16 }} padding="sm">
              <View style={styles.cardHeader}>
                <AppText bold>交易 {idx + 1}</AppText>
                <Pressable onPress={() => removeDraft(idx)} hitSlop={10}>
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={theme.colors.error} />
                </Pressable>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.typeSelector}>
                  <Pressable
                    style={[styles.typeBtn, d.type === 'expense' && styles.typeBtnActive]}
                    onPress={() => updateDraft(idx, { type: 'expense' })}
                  >
                    <AppText color={d.type === 'expense' ? '#fff' : theme.colors.textSecondary} variant="caption" bold>支出</AppText>
                  </Pressable>
                  <Pressable
                    style={[styles.typeBtn, d.type === 'income' && styles.typeBtnActive]}
                    onPress={() => updateDraft(idx, { type: 'income' })}
                  >
                    <AppText color={d.type === 'income' ? '#fff' : theme.colors.textSecondary} variant="caption" bold>收入</AppText>
                  </Pressable>
                </View>

                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" color={theme.colors.textSecondary}>分类</AppText>
                    <TextInput
                      style={styles.input}
                      value={d.category}
                      onChangeText={(v) => updateDraft(idx, { category: v })}
                      placeholder="分类"
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" color={theme.colors.textSecondary}>金额</AppText>
                    <TextInput
                      style={styles.input}
                      value={Number.isFinite(Number(d.amount)) ? String(d.amount) : ''}
                      onChangeText={(v) => updateDraft(idx, { amount: Number(v) })}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" color={theme.colors.textSecondary}>日期</AppText>
                    <TextInput
                      style={styles.input}
                      value={d.date}
                      onChangeText={(v) => updateDraft(idx, { date: v })}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                </View>

                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={[styles.input, { height: 'auto', minHeight: 30 }]}
                    value={d.description}
                    onChangeText={(v) => updateDraft(idx, { description: v })}
                    placeholder="备注..."
                    multiline
                  />
                </View>
              </View>
            </AppCard>
          ))}
        </View>

        <Pressable
          style={[styles.primaryButton, (saving || drafts.length === 0) ? styles.disabled : null, { marginBottom: 30 }]}
          onPress={onSaveAll}
          disabled={saving || drafts.length === 0}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" bold>全部保存 (离线队列)</AppText>}
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  textArea: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    height: 100,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 16,
    ...theme.shadows.medium
  },
  disabled: { opacity: 0.6 },

  bannerWarn: { backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#ffeeba', borderRadius: theme.roundness, padding: 12, marginTop: 12 },
  bannerInfo: { backgroundColor: '#d1ecf1', borderWidth: 1, borderColor: '#bee5eb', borderRadius: theme.roundness, padding: 12, marginTop: 12 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardContent: { gap: 12 },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 2,
    marginBottom: 4,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  inputRow: { flexDirection: 'row' },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingVertical: 4,
    fontSize: 15,
    color: theme.colors.textPrimary,
  }
});
