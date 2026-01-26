import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { createLocalTransaction } from '../../storage/localDB';
import { enqueue } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Simple date picker component since @react-native-community/datetimepicker may not be installed
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
        <View style={pickerStyles.container}>
          <Text style={pickerStyles.title}>选择日期</Text>
          <View style={pickerStyles.row}>
            <TextInput
              style={pickerStyles.input}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="年"
              accessibilityLabel="年份输入"
            />
            <Text style={pickerStyles.separator}>-</Text>
            <TextInput
              style={pickerStyles.input}
              value={month}
              onChangeText={setMonth}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="月"
              accessibilityLabel="月份输入"
            />
            <Text style={pickerStyles.separator}>-</Text>
            <TextInput
              style={pickerStyles.input}
              value={day}
              onChangeText={setDay}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="日"
              accessibilityLabel="日期输入"
            />
          </View>
          <View style={pickerStyles.buttons}>
            <Pressable style={pickerStyles.cancelBtn} onPress={onClose} accessibilityLabel="取消选择日期">
              <Text style={pickerStyles.cancelText}>取消</Text>
            </Pressable>
            <Pressable style={pickerStyles.confirmBtn} onPress={onConfirm} accessibilityLabel="确认选择日期">
              <Text style={pickerStyles.confirmText}>确定</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 280 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, width: 60, textAlign: 'center', fontSize: 16 },
  separator: { marginHorizontal: 4, fontSize: 18, color: '#666' },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  confirmBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', marginLeft: 8, backgroundColor: '#667eea', borderRadius: 8 },
  cancelText: { color: '#666', fontWeight: '600' },
  confirmText: { color: '#fff', fontWeight: '600' },
});

export default function AddTransactionScreen() {
  const navigation = useNavigation<NavigationProp>();
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

  const parsedAmount = useMemo(() => Number(amount), [amount]);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      setSuccess('已保存到本地（待同步）');
    } catch (e: any) {
      setError(e?.message ? String(e.message) : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <Pressable
        style={styles.aiEntry}
        onPress={() => navigation.navigate('AIAdd')}
        accessibilityLabel="进入 AI 智能记账"
        accessibilityRole="button"
      >
        <Text style={styles.aiEntryText}>AI 智能记账</Text>
      </Pressable>

      <Text style={styles.title}>新增记账</Text>
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, type === 'expense' ? styles.segmentActive : null]}
          onPress={() => setType('expense')}
          accessibilityLabel="选择支出类型"
          accessibilityRole="button"
        >
          <Text style={[styles.segmentText, type === 'expense' ? styles.segmentTextActive : null]}>支出</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, type === 'income' ? styles.segmentActive : null]}
          onPress={() => setType('income')}
          accessibilityLabel="选择收入类型"
          accessibilityRole="button"
        >
          <Text style={[styles.segmentText, type === 'income' ? styles.segmentTextActive : null]}>收入</Text>
        </Pressable>
      </View>

      {/* Date Picker */}
      <Pressable
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
        accessibilityLabel={`选择日期，当前日期 ${formatDate(date)}`}
        accessibilityRole="button"
      >
        <Text style={styles.dateLabel}>日期</Text>
        <Text style={styles.dateValue}>{formatDate(date)}</Text>
      </Pressable>
      {showDatePicker && (
        <SimpleDatePicker
          value={date}
          onChange={setDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="分类"
        accessibilityLabel="分类输入框"
      />
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="金额"
        keyboardType="decimal-pad"
        accessibilityLabel="金额输入框"
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="备注（可选）"
        multiline
        accessibilityLabel="备注输入框"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <Pressable
        style={styles.primaryButton}
        onPress={onSave}
        disabled={saving}
        accessibilityLabel="保存记账"
        accessibilityRole="button"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>保存</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  aiEntry: { backgroundColor: '#f0f5ff', borderWidth: 1, borderColor: '#adc6ff', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  aiEntryText: { color: '#2f54eb', fontSize: 14, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segment: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: '#667eea', borderColor: '#667eea' },
  segmentText: { fontWeight: '600', color: '#333' },
  segmentTextActive: { color: '#fff' },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12, backgroundColor: '#fafafa' },
  dateLabel: { color: '#666', fontSize: 14 },
  dateValue: { fontSize: 16, fontWeight: '500', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#667eea', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#f5222d', marginBottom: 8 },
  success: { color: '#52c41a', marginBottom: 8 },
});
