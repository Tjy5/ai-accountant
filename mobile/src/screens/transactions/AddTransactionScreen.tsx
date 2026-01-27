import React, { useMemo, useState } from 'react';
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
      setSuccess('已保存');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Dark Hero Header */}
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        {/* Type Selector Tabs */}
        <View style={styles.typeSelectorContainer}>
          <Pressable
            style={[styles.typeTab, type === 'expense' && styles.typeTabActive]}
            onPress={() => setType('expense')}
          >
            <AppText style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>支出</AppText>
          </Pressable>
          <Pressable
            style={[styles.typeTab, type === 'income' && styles.typeTabActive]}
            onPress={() => setType('income')}
          >
            <AppText style={[styles.typeText, type === 'income' && styles.typeTextActive]}>收入</AppText>
          </Pressable>
        </View>

        {/* Big Amount Input */}
        <View style={styles.amountInputContainer}>
          <AppText style={styles.currencySymbol}>¥</AppText>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>
      </LinearGradient>

      {/* Form Card */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Pressable style={styles.formRow} onPress={() => setShowDatePicker(true)}>
              <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                <MaterialCommunityIcons name="calendar-month" size={20} color="#64748B" />
              </View>
              <View style={styles.formInputWrapper}>
                <AppText variant="caption" color={theme.colors.textSecondary}>日期</AppText>
                <AppText style={styles.formValueText}>{formatDate(date)}</AppText>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.formRow}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="tag-multiple" size={20} color="#3B82F6" />
              </View>
              <View style={styles.formInputWrapper}>
                <AppText variant="caption" color={theme.colors.textSecondary}>分类</AppText>
                <TextInput
                  style={styles.formInput}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="餐饮, 交通..."
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={[styles.formRow, { alignItems: 'flex-start' }]}>
              <View style={[styles.iconBox, { backgroundColor: '#F0FDF4', marginTop: 4 }]}>
                <MaterialCommunityIcons name="text" size={20} color="#10B981" />
              </View>
              <View style={styles.formInputWrapper}>
                <AppText variant="caption" color={theme.colors.textSecondary}>备注</AppText>
                <TextInput
                  style={[styles.formInput, styles.multilineInput]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="添加备注..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                />
              </View>
            </View>
          </View>

          {error && <AppText color={theme.colors.error} centered style={{ marginTop: 16 }}>{error}</AppText>}
          {success && <AppText color="#10B981" centered style={{ marginTop: 16 }}>{success}</AppText>}

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.8 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <AppText color="#fff" variant="title" bold>保存</AppText>}
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>

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
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32, // Consistent curve
    borderBottomRightRadius: 32,
  },
  typeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 4,
    alignSelf: 'center',
    marginBottom: 32,
  },
  typeTab: {
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  typeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  typeText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontSize: 15,
  },
  typeTextActive: {
    color: '#FFF',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 32,
    color: '#FFF',
    fontWeight: '600',
    marginRight: 8,
    opacity: 0.8,
  },
  amountInput: {
    fontSize: 56,
    color: '#FFF',
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10, // Slight overlap visual if we used negative margin, but here we just flow
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24, // Generous padding
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginTop: -30, // Pull up to overlap header
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  formInputWrapper: {
    flex: 1,
  },
  formValueText: {
    fontSize: 17,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginTop: 2,
  },
  formInput: {
    fontSize: 17,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    padding: 0, // Remove default Android padding
    marginTop: 2,
  },
  multilineInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
    marginLeft: 56, // Align with text start
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 24,
    marginTop: 32,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
});
