import React, { useCallback, useState } from 'react';
import { SectionList, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { listCategories, CategoryRecord } from '../../storage/localDB';
import { theme } from '../../theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CategoryListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [sections, setSections] = useState<{ title: string; data: CategoryRecord[] }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const all = await listCategories(user.id);
      const income = all.filter(c => c.type === 'income');
      const expense = all.filter(c => c.type === 'expense');
      const both = all.filter(c => c.type === 'both');

      setSections([
        { title: '支出分类', data: expense },
        { title: '收入分类', data: income },
        { title: '通用分类', data: both },
      ].filter(s => s.data.length > 0));
    } catch (e) {
      console.error('Failed to load categories:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.id}`}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.header}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => navigation.navigate('CategoryEdit', { id: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`编辑分类 ${item.name}`}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBox, { backgroundColor: item.color || '#eee' }]}>
                <MaterialCommunityIcons name={(item.icon || 'tag') as any} size={20} color="#fff" />
              </View>
              <Text style={styles.name}>{item.name}</Text>
              {item.is_default ? <Text style={styles.defaultTag}>默认</Text> : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无分类</Text>}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('CategoryEdit', {})}
        accessibilityRole="button"
        accessibilityLabel="新增分类"
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f5f5f5', fontSize: 13, color: '#666', fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  pressed: { backgroundColor: '#f9f9f9' },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12
  },
  name: { fontSize: 16, color: '#333' },
  defaultTag: { marginLeft: 8, fontSize: 10, color: '#999', backgroundColor: '#f0f0f0', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84
  },
});
