import React, { useMemo, useState, useEffect } from 'react';
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
  Alert
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getTransaction, updateLocalTransaction } from '../../storage/localDB';
import { enqueue } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionEdit'>;

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
            <TextInput style={pickerStyles.input} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} placeholder="年" />
            <Text style={pickerStyles.separator}>-</Text>
            <TextInput style={pickerStyles.input} value={month} onChangeText={setMonth} keyboardType="number-pad" maxLength={2} placeholder="月" />
            <Text style={pickerStyles.separator}>-</Text>
            <TextInput style={pickerStyles.input} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} placeholder="日" />
          </View>
          <View style={pickerStyles.buttons}>
            <Pressable style={pickerStyles.cancelBtn} onPress={onClose}>
              <Text style={pickerStyles.cancelText}>取消</Text>
            </Pressable>
            <Pressable style={pickerStyles.confirmBtn} onPress={onConfirm}>
              <Text style={pickerStyles.confirmText}>确定</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function EditTransactionScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { id } = route.params;
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const tx = await getTransaction(user.id, id);
        if (tx) {
          setType(tx.type);
          setCategory(tx.category);
          setAmount(String(tx.amount));
          setDescription(tx.description || '');
          const raw = String(tx.date || '');
          const parsed = raw.includes(' ') ? new Date(raw.replace(' ', 'T') + 'Z') : new Date(raw);
          setDate(!isNaN(parsed.getTime()) ? parsed : new Date());
        } else {
          Alert.alert('错误', '找不到该交易记录', [{ text: '返回', onPress: () => navigation.goBack() }]);
        }
      } catch (e) {
        Alert.alert('错误', '读取交易失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user, navigation]);

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
      const updated = await updateLocalTransaction(user.id, id, {
        type,
        category: category.trim(),
        amount: parsedAmount,
        description,
        date: date.toISOString(),
      });
      await enqueue(user.id, 'transactions', 'upsert', updated);
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : '保存失败');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, type === 'expense' ? styles.segmentActive : null]}
          onPress={() => setType('expense')}
          accessibilityRole="radio"
          accessibilityState={{ checked: type === 'expense' }}
          accessibilityLabel="选择支出类型"
        >
          <Text style={[styles.segmentText, type === 'expense' ? styles.segmentTextActive : null]}>支出</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, type === 'income' ? styles.segmentActive : null]}
          onPress={() => setType('income')}
          accessibilityRole="radio"
          accessibilityState={{ checked: type === 'income' }}
          accessibilityLabel="选择收入类型"
        >
          <Text style={[styles.segmentText, type === 'income' ? styles.segmentTextActive : null]}>收入</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`选择日期，当前日期 ${formatDate(date)}`}
      >
        <Text style={styles.dateLabel}>日期</Text>
        <Text style={styles.dateValue}>{formatDate(date)}</Text>
      </Pressable>
      {showDatePicker && (
        <SimpleDatePicker value={date} onChange={setDate} onClose={() => setShowDatePicker(false)} />
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

      <Pressable
        style={styles.primaryButton}
        onPress={onSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="保存修改"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>保存修改</Text>}
      </Pressable>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },
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
});
