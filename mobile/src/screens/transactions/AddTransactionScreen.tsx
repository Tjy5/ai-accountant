import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Modal,
  ScrollView,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { createLocalTransaction } from '../../storage/localDB';
import { enqueue } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { theme } from '../../theme';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppText } from '../../components/AppText';
import { AppCard } from '../../components/AppCard';
import { AIInputModal, AIInputMode } from '../../components/AIInputModal';
import type { AITransactionDraft } from '../../../../shared/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function SimpleDatePicker({
  value,
  onChange,
  onClose,
}: {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}) {
  const [year, setYear] = useState(String(value.getFullYear()));
  const [month, setMonth] = useState(String(value.getMonth() + 1).padStart(2, '0'));
  const [day, setDay] = useState(String(value.getDate()).padStart(2, '0'));

  const onConfirm = () => {
    const newDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(newDate.getTime())) {
      onChange(newDate);
    }
    onClose();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <AppCard style={pickerStyles.container}>
          <AppText variant="title" centered style={{ marginBottom: 20 }}>选择日期</AppText>
          <View style={pickerStyles.row}>
            <TextInput style={pickerStyles.input} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
            <AppText style={pickerStyles.separator}>-</AppText>
            <TextInput style={pickerStyles.input} value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} />
            <AppText style={pickerStyles.separator}>-</AppText>
            <TextInput style={pickerStyles.input} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} />
          </View>
          <View style={pickerStyles.buttons}>
            <Pressable style={[pickerStyles.btn, pickerStyles.btnCancel]} onPress={onClose}>
              <AppText color={theme.colors.textSecondary}>取消</AppText>
            </Pressable>
            <Pressable style={[pickerStyles.btn, pickerStyles.btnConfirm]} onPress={onConfirm}>
              <AppText color="#fff" bold>确定</AppText>
            </Pressable>
          </View>
        </AppCard>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  container: { width: 300 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    textAlign: 'center',
    fontSize: 18,
    paddingVertical: 4,
    width: 60,
    color: theme.colors.textPrimary
  },
  separator: { marginHorizontal: 8, fontSize: 18, color: theme.colors.textSecondary },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: theme.roundness },
  btnCancel: { backgroundColor: theme.colors.surfaceVariant },
  btnConfirm: { backgroundColor: theme.colors.primary },
});

export default function AddTransactionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AIInputMode>(null);

  const parsedAmount = useMemo(() => Number(amount), [amount]);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y} -${m} -${day} `;
  };

  const onSave = async () => {
    if (!user) return;
    setError(null);
    setSuccess(null);

    if (!category.trim()) {
      setError('请输入分类');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('请输入正确金额');
      return;
    }

    setSaving(true);
    try {
      const tx = await createLocalTransaction(user.id, {
        type,
        category,
        amount: parsedAmount,
        description,
        date: date.toISOString(),
      });
      await enqueue(user.id, 'transactions', 'upsert', tx);
      setCategory('');
      setAmount('');
      setDescription('');
      setDate(new Date());
      setSuccess('已保存');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Handle AI result - fill form with recognized transaction
  const handleAIResult = (draft: AITransactionDraft) => {
    if (draft.type) setType(draft.type);
    if (draft.category) setCategory(draft.category);
    if (draft.amount) setAmount(String(draft.amount));
    if (draft.description) setDescription(draft.description);
    if (draft.date) {
      const parsed = new Date(draft.date);
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
    setSuccess('AI 已识别，请确认后保存');
    setTimeout(() => setSuccess(null), 3000);
  };

  if (!user) return null;

  const isExpense = type === 'expense';
  const activeColor = isExpense ? theme.colors.error : '#10B981';
  const activeBg = isExpense ? '#FEF2F2' : '#ECFDF5';

  const inputRef = useRef<TextInput>(null);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Top Section: Dark Gradient with Amount */}
      <LinearGradient
        colors={theme.colors.wealth?.gradients?.header || ['#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerSection, { paddingTop: insets.top + 10 }]}
      >
        {/* Type Switcher */}
        <View style={styles.typeSegment}>
          <Pressable
            style={[styles.segmentTab, type === 'expense' && styles.segmentTabActive]}
            onPress={() => setType('expense')}
          >
            <AppText style={[styles.segmentText, type === 'expense' && styles.segmentTextActive]}>支出</AppText>
          </Pressable>
          <Pressable
            style={[styles.segmentTab, type === 'income' && styles.segmentTabActive]}
            onPress={() => setType('income')}
          >
            <AppText style={[styles.segmentText, type === 'income' && styles.segmentTextActive]}>收入</AppText>
          </Pressable>
        </View>

        {/* Amount Input (Custom Text Display + Hidden Input) */}
        <Pressable
          style={styles.amountContainer}
          onPress={() => inputRef.current?.focus()}
        >
          <AppText style={styles.currencySymbol}>¥</AppText>
          <AppText style={[styles.amountText, !amount && styles.amountPlaceholder]}>
            {amount || '0.00'}
          </AppText>
          {/* Blinking Cursor Indicator */}
          <View style={styles.cursor} />

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            caretHidden
          />
        </Pressable>

        {/* AI Action Buttons */}
        <View style={styles.aiButtonsRow}>
          <Pressable style={styles.aiButton} onPress={() => setAiMode('text')}>
            <View style={styles.aiButtonIcon}>
              <MaterialCommunityIcons name="text-recognition" size={22} color="#fff" />
            </View>
            <AppText style={styles.aiButtonLabel}>文字</AppText>
          </Pressable>
          <Pressable style={styles.aiButton} onPress={() => setAiMode('voice')}>
            <View style={[styles.aiButtonIcon, { backgroundColor: '#10B981' }]}>
              <MaterialCommunityIcons name="microphone" size={22} color="#fff" />
            </View>
            <AppText style={styles.aiButtonLabel}>语音</AppText>
          </Pressable>
          <Pressable style={styles.aiButton} onPress={() => setAiMode('voice-text')}>
            <View style={[styles.aiButtonIcon, { backgroundColor: '#8B5CF6' }]}>
              <MaterialCommunityIcons name="keyboard-outline" size={22} color="#fff" />
            </View>
            <AppText style={styles.aiButtonLabel}>输入法</AppText>
          </Pressable>
          <Pressable style={styles.aiButton} onPress={() => setAiMode('camera')}>
            <View style={[styles.aiButtonIcon, { backgroundColor: '#F59E0B' }]}>
              <MaterialCommunityIcons name="camera" size={22} color="#fff" />
            </View>
            <AppText style={styles.aiButtonLabel}>拍照</AppText>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Bottom Section: Light Sheet with Form */}
      <View style={styles.sheetContainer}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Form Fields - Clean List Style */}
            <View style={styles.formList}>
              {/* Date Row */}
              <Pressable style={styles.fieldRow} onPress={() => setShowDatePicker(true)}>
                <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                  <MaterialCommunityIcons name="calendar-month" size={22} color="#64748B" />
                </View>
                <View style={styles.fieldContent}>
                  <AppText style={styles.fieldLabel}>日期</AppText>
                  <AppText style={styles.fieldValue}>{formatDate(date)}</AppText>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
              </Pressable>

              <View style={styles.separator} />

              {/* Category Row */}
              <View style={styles.fieldRow}>
                <View style={[styles.iconCircle, { backgroundColor: activeBg }]}>
                  <MaterialCommunityIcons name="tag-outline" size={22} color={activeColor} />
                </View>
                <View style={styles.fieldContent}>
                  <AppText style={styles.fieldLabel}>分类</AppText>
                  <TextInput
                    style={styles.fieldInput}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="餐饮, 交通..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.separator} />

              {/* Note Row */}
              <View style={[styles.fieldRow, { alignItems: 'flex-start', paddingTop: 16 }]}>
                <View style={[styles.iconCircle, { backgroundColor: '#F8FAFC' }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={22} color="#94A3B8" />
                </View>
                <View style={styles.fieldContent}>
                  <AppText style={styles.fieldLabel}>备注</AppText>
                  <TextInput
                    style={[styles.fieldInput, styles.multilineInput]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="添加备注..."
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
              </View>
            </View>

            {/* Messages */}
            {error && <AppText color={theme.colors.error} centered style={{ marginTop: 20 }}>{error}</AppText>}
            {success && <AppText color="#10B981" centered style={{ marginTop: 20 }}>{success}</AppText>}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Floating Bottom Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.saveButton, { backgroundColor: activeColor }, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText style={styles.saveButtonText}>保 存</AppText>
            )}
          </Pressable>
        </View>
      </View>

      {/* AI Input Modal */}
      <AIInputModal
        visible={aiMode !== null}
        mode={aiMode}
        onClose={() => setAiMode(null)}
        onResult={handleAIResult}
      />

      {showDatePicker && (
        <SimpleDatePicker
          value={date}
          onChange={setDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E293B', // Background matches header color
  },
  headerSection: {
    // Height determined by content + padding
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    paddingBottom: 50, // Space for the sheet overlap
  },
  typeSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  segmentTab: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  segmentTabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  segmentTextActive: {
    color: '#FFF',
  },

  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline', // Proper typographic alignment
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 20,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 6,
    color: '#FFF',
    opacity: 0.9,
    lineHeight: 52, // Match amountText lineHeight for baseline alignment
  },
  amountText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 52,
  },
  amountPlaceholder: {
    color: 'rgba(255,255,255,0.3)',
  },
  cursor: {
    width: 3,
    height: 40,
    backgroundColor: '#3B82F6',
    marginLeft: 2,
    borderRadius: 2,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  sheetContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    marginTop: -20, // Small overlap for seamless look
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },
  formList: {
    // No background, just form fields
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 56,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  fieldInput: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
    padding: 0,
    height: 24,
    textAlignVertical: 'center',
  },
  multilineInput: {
    minHeight: 24,
    textAlignVertical: 'top',
    maxHeight: 100,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // AI Buttons
  aiButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  aiButton: {
    alignItems: 'center',
  },
  aiButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  aiButtonLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
});
