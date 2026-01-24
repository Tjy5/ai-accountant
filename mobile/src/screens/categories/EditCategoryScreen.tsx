import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { getCategory, createLocalCategory, updateLocalCategory, softDeleteLocalCategory } from '../../storage/localDB';
import { enqueue } from '../../sync/offlineQueue';
import { theme } from '../../theme';
import IconPicker from '../../components/IconPicker';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CategoryEdit'>;
type RouteProps = RouteProp<RootStackParamList, 'CategoryEdit'>;

export default function EditCategoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { user } = useAuth();
  const id = route.params?.id;

  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'both'>('expense');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState('#667eea');
  const [isDefault, setIsDefault] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCategory = async () => {
      if (!id || !user) {
        navigation.setOptions({ title: '新增分类' });
        return;
      }
      setLoading(true);
      try {
        const cat = await getCategory(user.id, id);
        if (cat) {
          setName(cat.name);
          setType(cat.type);
          setIcon(cat.icon || 'tag');
          setColor(cat.color || '#667eea');
          setIsDefault(!!cat.is_default);
          navigation.setOptions({ title: '编辑分类' });
        }
      } catch (e) {
        Alert.alert('错误', '读取分类失败');
      } finally {
        setLoading(false);
      }
    };
    loadCategory();
  }, [id, user, navigation]);

  const onSave = async () => {
    if (!user || !name.trim()) {
      Alert.alert('提示', '请输入分类名称');
      return;
    }
    setSaving(true);
    try {
      const data = { name: name.trim(), type, icon, color };
      if (id) {
        const updated = await updateLocalCategory(user.id, id, data);
        await enqueue(user.id, 'categories', 'upsert', updated);
      } else {
        const newCat = await createLocalCategory(user.id, data);
        await enqueue(user.id, 'categories', 'upsert', newCat);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('错误', e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!user || !id) return;
    if (isDefault) {
      Alert.alert('提示', '默认分类不可删除');
      return;
    }
    Alert.alert('确认删除', '删除后不可恢复', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const deletedAt = await softDeleteLocalCategory(user.id, id);
            await enqueue(user.id, 'categories', 'upsert', { id, deleted_at: deletedAt });
            navigation.goBack();
          } catch (e) {
            Alert.alert('错误', '删除失败');
          }
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.form}>
        <View style={styles.typeRow}>
          {(['expense', 'income', 'both'] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
              accessibilityRole="radio"
              accessibilityState={{ checked: type === t }}
              accessibilityLabel={`选择${t === 'income' ? '收入' : t === 'expense' ? '支出' : '通用'}`}
            >
              <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                {t === 'income' ? '收入' : t === 'expense' ? '支出' : '通用'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="分类名称"
          accessibilityLabel="分类名称输入框"
        />

        <Pressable
          style={styles.iconSelector}
          onPress={() => setShowIconPicker(true)}
          accessibilityLabel={`选择图标，当前图标 ${icon}`}
        >
          <Text style={styles.label}>图标</Text>
          <MaterialCommunityIcons name={icon as any} size={24} color={color} />
        </Pressable>

        <IconPicker
          visible={showIconPicker}
          selected={icon}
          onSelect={setIcon}
          onClose={() => setShowIconPicker(false)}
        />

        <Pressable style={styles.saveBtn} onPress={onSave} disabled={saving} accessibilityLabel="保存分类">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>保存</Text>}
        </Pressable>

        {id && !isDefault ? (
          <Pressable style={styles.deleteBtn} onPress={onDelete} accessibilityLabel="删除分类">
            <Text style={styles.deleteText}>删除分类</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { padding: 20 },
  typeRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  typeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  typeText: { color: '#666', fontWeight: '500' },
  typeTextActive: { color: theme.colors.primary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  iconSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 30 },
  label: { fontSize: 16, color: '#333' },
  saveBtn: { backgroundColor: theme.colors.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { marginTop: 16, padding: 14, alignItems: 'center' },
  deleteText: { color: theme.colors.error, fontSize: 16 },
});
