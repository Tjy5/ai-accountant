import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ICONS = [
  'food', 'shopping-outline', 'bus', 'train', 'car', 'gas-station',
  'home', 'lightbulb', 'water', 'phone', 'wifi',
  'medical-bag', 'pill', 'hospital-building',
  'school', 'book-open-variant',
  'gamepad-variant', 'movie', 'music',
  'cash', 'bank', 'credit-card',
  'gift', 'briefcase', 'account'
];

interface Props {
  visible: boolean;
  selected: string | null;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

export default function IconPicker({ visible, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>选择图标</Text>
          <FlatList
            data={ICONS}
            keyExtractor={(item) => item}
            numColumns={5}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.item, selected === item && styles.selectedItem]}
                onPress={() => { onSelect(item); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel={`选择图标 ${item}`}
              >
                <MaterialCommunityIcons
                  name={item as any}
                  size={24}
                  color={selected === item ? '#fff' : '#666'}
                />
              </Pressable>
            )}
          />
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="关闭图标选择">
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  list: { alignItems: 'center' },
  item: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  selectedItem: {
    backgroundColor: '#667eea',
  },
  closeBtn: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 10 },
  closeText: { fontSize: 16, color: '#666', fontWeight: '600' },
});
