import React, { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { getTransaction, updateLocalTransaction } from '../../storage/localDB';
import { enqueue } from '../../sync/offlineQueue';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { theme } from '../../theme';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { AppText } from '../../components/AppText';
import { AppCard } from '../../components/AppCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          <View style={styles.typeSelector}>
            <Pressable
              style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]}
              onPress={() => setType('expense')}
            >
              <AppText color={type === 'expense' ? '#fff' : theme.colors.textSecondary} bold>支出</AppText>
            </Pressable>
            <Pressable
              style={[styles.typeBtn, type === 'income' && styles.typeBtnActive]}
              onPress={() => setType('income')}
            >
              <AppText color={type === 'income' ? '#fff' : theme.colors.textSecondary} bold>收入</AppText>
            </Pressable>
          </View>

          <AppCard>
            <Pressable style={styles.formItem} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.textSecondary} style={styles.icon} />
              <AppText>{formatDate(date)}</AppText>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.formItem}>
              <MaterialCommunityIcons name="tag-outline" size={20} color={theme.colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="分类"
                placeholderTextColor={theme.colors.textSecondary + '80'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.formItem}>
              <MaterialCommunityIcons name="currency-cny" size={20} color={theme.colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.colors.textSecondary + '80'}
              />
            </View>

            <View style={styles.divider} />

            <View style={[styles.formItem, { alignItems: 'flex-start', minHeight: 80 }]}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.textSecondary} style={[styles.icon, { marginTop: 4 }]} />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="备注..."
                multiline
                placeholderTextColor={theme.colors.textSecondary + '80'}
              />
            </View>
          </AppCard>

          {error && <AppText color={theme.colors.error} style={{ marginTop: 12, marginLeft: 8 }}>{error}</AppText>}

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" variant="title" bold>保存修改</AppText>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {showDatePicker && (
        <SimpleDatePicker value={date} onChange={setDate} onClose={() => setShowDatePicker(false)} />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.roundness,
    padding: 4,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: theme.roundness - 4,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  icon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  multiline: {
    height: 60,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceVariant,
    marginLeft: 32,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 32,
    ...theme.shadows.medium,
  },
});
