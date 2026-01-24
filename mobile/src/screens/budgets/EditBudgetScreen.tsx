import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { createLocalBudget, getBudget, listBudgets, listCategories, softDeleteLocalBudget, updateLocalBudget, BudgetRecord, CategoryRecord } from '../../storage/localDB';
import { enqueue } from '../../sync/offlineQueue';
import { theme } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { PERIOD_LABELS } from '../../../../shared/constants/budget';

type NavigationProp = any;
type RouteProps = RouteProp<RootStackParamList, 'BudgetEdit'>;
type Period = 'monthly' | 'quarterly' | 'yearly';

const computeLimits = (amount: number, period: Period) => {
  if (period === 'monthly') return { monthly: amount, quarterly: amount * 3, yearly: amount * 12 };
  if (period === 'quarterly') return { monthly: amount / 3, quarterly: amount, yearly: amount * 4 };
  return { monthly: amount / 12, quarterly: amount / 4, yearly: amount };
};

function CategoryPicker({ visible, categories, onSelect, onClose }: {
  visible: boolean;
  categories: CategoryRecord[];
  onSelect: (cat: CategoryRecord) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.container}>
          <View style={pickerStyles.headerRow}>
            <Text style={pickerStyles.title}>选择分类</Text>
            <Pressable onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color="#666" />
            </Pressable>
          </View>
          <View style={pickerStyles.list}>
            {categories.map((cat) => (
              <Pressable
                key={String(cat.id)}
                style={({ pressed }) => [pickerStyles.item, pressed && pickerStyles.pressed]}
                onPress={() => onSelect(cat)}
              >
                <View style={[pickerStyles.iconBox, { backgroundColor: cat.color || '#eee' }]}>
                  <MaterialCommunityIcons name={(cat.icon || 'tag') as any} size={18} color="#fff" />
                </View>
                <Text style={pickerStyles.itemText}>{cat.name}</Text>
              </Pressable>
            ))}
            {categories.length === 0 && <Text style={pickerStyles.empty}>暂无可用分类</Text>}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: 320, maxHeight: 420 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#333' },
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  pressed: { backgroundColor: '#f7f7f7' },
  iconBox: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  itemText: { fontSize: 15, color: '#333' },
  empty: { textAlign: 'center', color: '#999', paddingVertical: 20 },
});

export default function EditBudgetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { user } = useAuth();

  const id = route.params?.id;
  const presetType = route.params?.budgetType;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetType, setBudgetType] = useState<'total' | 'category'>(presetType || 'category');
  const [period, setPeriod] = useState<Period>('monthly');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [parentId, setParentId] = useState<number | null>(route.params?.parentId ?? null);
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      try {
        if (!user) return;

        const cats = await listCategories(user.id);
        if (!active) return;
        setCategories(cats.filter(c => c.type === 'expense' || c.type === 'both'));

        if (!id) {
          navigation.setOptions({ title: '新增预算' });
          if (!presetType) {
            const all = await listBudgets(user.id);
            const hasTotal = all.some(b => b.budget_type === 'total');
            if (!hasTotal) setBudgetType('total');
          }
          return;
        }

        const budget = await getBudget(user.id, id);
        if (!active) return;
        if (!budget) {
          Alert.alert('错误', '找不到该预算', [{ text: '返回', onPress: () => navigation.goBack() }]);
          return;
        }

        setBudgetType(budget.budget_type);
        const p = (budget.period || 'monthly') as Period;
        setPeriod(p);

        const monthly = Number(budget.monthly_limit) || 0;
        const quarterly = budget.quarterly_limit != null ? Number(budget.quarterly_limit) : monthly * 3;
        const yearly = budget.yearly_limit != null ? Number(budget.yearly_limit) : monthly * 12;
        const displayAmount = p === 'quarterly' ? quarterly : p === 'yearly' ? yearly : monthly;
        setBudgetAmount(displayAmount > 0 ? String(displayAmount) : '');

        setCategoryId(budget.category_id ?? null);
        setCategoryName(budget.category ?? '');
        setParentId(budget.parent_id ?? null);
        setAlertThreshold(String(budget.alert_threshold ?? 80));
        setIsActive(budget.is_active !== 0);
        setDescription(budget.description ?? '');
        navigation.setOptions({ title: budget.budget_type === 'total' ? '编辑总预算' : '编辑分类预算' });
      } catch (e) {
        console.error('Failed to load budget:', e);
        if (active) Alert.alert('错误', '读取预算失败');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [id, user, navigation, presetType]);

  const parsedAmount = useMemo(() => Number(budgetAmount), [budgetAmount]);
  const parsedThreshold = useMemo(() => Number(alertThreshold), [alertThreshold]);

  const onSave = useCallback(async () => {
    if (!user) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('提示', '请输入正确的预算金额');
      return;
    }
    if (Number.isFinite(parsedThreshold) && (parsedThreshold < 50 || parsedThreshold > 100)) {
      Alert.alert('提示', '预警阈值应在 50-100 之间');
      return;
    }
    if (budgetType === 'category' && !categoryId) {
      Alert.alert('提示', '请选择分类');
      return;
    }

    setSaving(true);
    try {
      const all = await listBudgets(user.id);
      const total = all.find(b => b.budget_type === 'total') || null;
      const otherCategoryBudgets = all.filter(b => b.budget_type === 'category' && (!id || b.id !== id));
      const allocatedMonthly = otherCategoryBudgets.reduce((sum, b) => sum + (Number(b.monthly_limit) || 0), 0);

      const limits = computeLimits(parsedAmount, period);

      if (budgetType === 'total') {
        if (allocatedMonthly > limits.monthly) {
          Alert.alert('提示', '总预算（月）不能小于已分配的分类预算（月）');
          return;
        }
      } else {
        if (!total) {
          Alert.alert('提示', '请先创建总预算');
          return;
        }
        if (allocatedMonthly + limits.monthly > (Number(total.monthly_limit) || 0)) {
          Alert.alert('提示', '分类预算（月）之和不能超过总预算（月）');
          return;
        }
        setParentId(total.id);
      }

      const input = {
        budget_type: budgetType,
        category: budgetType === 'category' ? (categoryName || null) : null,
        category_id: budgetType === 'category' ? (categoryId || null) : null,
        parent_id: budgetType === 'category' ? (total?.id ?? parentId ?? null) : null,
        monthly_limit: limits.monthly,
        quarterly_limit: limits.quarterly,
        yearly_limit: limits.yearly,
        period,
        start_date: null,
        end_date: null,
        alert_threshold: Number.isFinite(parsedThreshold) ? parsedThreshold : 80,
        is_active: isActive ? 1 : 0,
        description: description.trim() ? description.trim() : null,
      } as const;

      let saved: BudgetRecord;
      if (id) {
        saved = await updateLocalBudget(user.id, id, input);
      } else {
        saved = await createLocalBudget(user.id, input);
      }
      await enqueue(user.id, 'budgets', 'upsert', saved);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('错误', e?.message ? String(e.message) : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [user, parsedAmount, parsedThreshold, budgetType, categoryId, categoryName, period, id, isActive, description, navigation, parentId]);

  const onDelete = useCallback(() => {
    if (!user || !id) return;
    Alert.alert('确认删除', '删除后将标记为已删除（可同步到服务端）', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            if (budgetType === 'total') {
              const all = await listBudgets(user.id);
              const hasChildren = all.some(b => b.budget_type === 'category');
              if (hasChildren) {
                Alert.alert('提示', '请先删除所有分类预算');
                return;
              }
            }
            const deletedAt = await softDeleteLocalBudget(user.id, id);
            await enqueue(user.id, 'budgets', 'upsert', { id, deleted_at: deletedAt, updated_at: deletedAt });
            navigation.goBack();
          } catch (e) {
            Alert.alert('错误', '删除失败');
          }
        }
      }
    ]);
  }, [user, id, budgetType, navigation]);

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const canChangeType = !id;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.form}>
        <Text style={styles.label}>预算类型</Text>
        <View style={styles.segmentRow}>
          {(['total', 'category'] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.segment, budgetType === t && styles.segmentActive, !canChangeType && styles.segmentDisabled]}
              onPress={() => canChangeType && setBudgetType(t)}
              accessibilityRole="radio"
              accessibilityState={{ checked: budgetType === t, disabled: !canChangeType }}
              accessibilityLabel={t === 'total' ? '总预算' : '分类预算'}
            >
              <Text style={[styles.segmentText, budgetType === t && styles.segmentTextActive]}>
                {t === 'total' ? '总预算' : '分类预算'}
              </Text>
            </Pressable>
          ))}
        </View>

        {budgetType === 'category' && (
          <>
            <Text style={styles.label}>分类</Text>
            <Pressable
              style={styles.selector}
              onPress={() => setShowCategoryPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={categoryId ? `当前选择分类: ${categoryName}` : '选择分类'}
            >
              <Text style={styles.selectorText}>{categoryId ? categoryName : '请选择分类'}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
            </Pressable>
            <CategoryPicker
              visible={showCategoryPicker}
              categories={categories}
              onSelect={(cat) => {
                setCategoryId(String(cat.id));
                setCategoryName(cat.name);
                setShowCategoryPicker(false);
              }}
              onClose={() => setShowCategoryPicker(false)}
            />
          </>
        )}

        <Text style={styles.label}>预算周期</Text>
        <View style={styles.segmentRow}>
          {(['monthly', 'quarterly', 'yearly'] as const).map((p) => (
            <Pressable
              key={p}
              style={[styles.segment, period === p && styles.segmentActive]}
              onPress={() => setPeriod(p)}
              accessibilityRole="radio"
              accessibilityState={{ checked: period === p }}
              accessibilityLabel={(PERIOD_LABELS as any)[p] || p}
            >
              <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>
                {(PERIOD_LABELS as any)[p] || p}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>预算金额</Text>
        <TextInput
          style={styles.input}
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          placeholder="例如：3000"
          keyboardType="decimal-pad"
          accessibilityLabel="预算金额输入框"
        />

        <Text style={styles.label}>预警阈值（%）</Text>
        <TextInput
          style={styles.input}
          value={alertThreshold}
          onChangeText={setAlertThreshold}
          placeholder="80"
          keyboardType="number-pad"
          accessibilityLabel="预警阈值百分比输入框"
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>启用</Text>
          <Switch value={isActive} onValueChange={setIsActive} accessibilityLabel="启用预算开关" />
        </View>

        <Text style={styles.label}>备注（可选）</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="预算说明"
          multiline
          accessibilityLabel="备注输入框"
        />

        <Pressable
          style={styles.primaryButton}
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="保存预算"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>保存</Text>}
        </Pressable>

        {id && (
          <Pressable style={styles.deleteButton} onPress={onDelete} accessibilityRole="button" accessibilityLabel="删除预算">
            <Text style={styles.deleteText}>删除预算</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 8 },
  segmentRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 10, padding: 4, gap: 8 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2 },
  segmentDisabled: { opacity: 0.7 },
  segmentText: { color: '#666', fontWeight: '600', fontSize: 12 },
  segmentTextActive: { color: theme.colors.primary },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  selectorText: { fontSize: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  primaryButton: { marginTop: 16, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteButton: { marginTop: 12, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ffccc7' },
  deleteText: { color: theme.colors.error, fontSize: 15, fontWeight: '700' },
});
