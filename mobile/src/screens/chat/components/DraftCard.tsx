import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { AppText } from '../../../components/AppText';
import type { ChatTransactionDraft, Category } from '../../../../../shared/types';

interface DraftCardProps {
  draft: ChatTransactionDraft;
  categories: Category[];
  onSave: () => Promise<void> | void;
  onDiscard: () => void;
}

export default function DraftCard({ draft, categories, onSave, onDiscard }: DraftCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState({ ...draft });

  const isSaved = draft.saved;

  const getConfidenceColor = (confidence: number = 0) => {
    if (confidence >= 0.8) return '#52c41a';
    if (confidence >= 0.5) return '#faad14';
    return '#ff4d4f';
  };

  const amountColor = draft.type === 'expense'
    ? theme.colors.wealth?.functional?.expense || '#EF4444'
    : theme.colors.wealth?.functional?.income || '#10B981';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setEditData({ ...draft });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleConfirmEdit = () => {
    // In a real implementation, you'd update the draft in parent
    setIsEditing(false);
  };

  if (isSaved) {
    return (
      <View style={[styles.card, styles.savedCard]}>
        <View style={styles.savedOverlay}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#52c41a" />
          <AppText color="#52c41a" bold style={{ marginLeft: 8 }}>已保存</AppText>
        </View>
        <View style={styles.header}>
          <AppText variant="title" bold style={{ color: amountColor, opacity: 0.5 }}>
            {draft.type === 'expense' ? '-' : '+'}¥{Number(draft.amount).toFixed(2)}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, isEditing && styles.editingCard]}>
      {/* Confidence indicator */}
      {draft.confidence !== undefined && (
        <View
          style={[
            styles.confidenceDot,
            { backgroundColor: getConfidenceColor(draft.confidence) },
          ]}
        />
      )}

      {/* Header with amount */}
      <View style={styles.header}>
        <AppText variant="title" bold style={{ color: amountColor, fontSize: 24 }}>
          {draft.type === 'expense' ? '-' : '+'}¥{Number(draft.amount).toFixed(2)}
        </AppText>
        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <Pressable onPress={handleCancelEdit} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable onPress={handleConfirmEdit} hitSlop={10} style={{ marginLeft: 12 }}>
                <MaterialCommunityIcons name="check" size={20} color={theme.colors.wealth?.functional?.income} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={handleEdit} hitSlop={10} disabled={isSaving}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable onPress={onDiscard} hitSlop={10} style={{ marginLeft: 12 }} disabled={isSaving}>
                <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="tag-outline" size={14} color={theme.colors.textMuted} />
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editData.category}
              onChangeText={(v) => setEditData(prev => ({ ...prev, category: v }))}
              placeholder="分类"
              placeholderTextColor={theme.colors.textMuted}
            />
          ) : (
            <AppText variant="caption" style={{ marginLeft: 4 }}>{draft.category}</AppText>
          )}
        </View>
        <View style={styles.detailItem}>
          <MaterialCommunityIcons name="calendar-outline" size={14} color={theme.colors.textMuted} />
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editData.date}
              onChangeText={(v) => setEditData(prev => ({ ...prev, date: v }))}
              placeholder="日期"
              placeholderTextColor={theme.colors.textMuted}
            />
          ) : (
            <AppText variant="caption" color={theme.colors.textSecondary} style={{ marginLeft: 4 }}>
              {draft.date}
            </AppText>
          )}
        </View>
      </View>

      {/* Description */}
      {(draft.description || isEditing) && (
        <View style={styles.descriptionRow}>
          {isEditing ? (
            <TextInput
              style={[styles.editInput, { flex: 1 }]}
              value={editData.description}
              onChangeText={(v) => setEditData(prev => ({ ...prev, description: v }))}
              placeholder="备注"
              placeholderTextColor={theme.colors.textMuted}
            />
          ) : (
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {draft.description}
            </AppText>
          )}
        </View>
      )}

      {/* Type toggle in edit mode */}
      {isEditing && (
        <View style={styles.typeToggle}>
          <Pressable
            style={[styles.typeBtn, editData.type === 'expense' && styles.typeBtnActive]}
            onPress={() => setEditData(prev => ({ ...prev, type: 'expense' }))}
          >
            <AppText
              variant="caption"
              bold
              color={editData.type === 'expense' ? '#fff' : theme.colors.textSecondary}
            >
              支出
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.typeBtn, editData.type === 'income' && styles.typeBtnActive]}
            onPress={() => setEditData(prev => ({ ...prev, type: 'income' }))}
          >
            <AppText
              variant="caption"
              bold
              color={editData.type === 'income' ? '#fff' : theme.colors.textSecondary}
            >
              收入
            </AppText>
          </Pressable>
        </View>
      )}

      {/* Save button */}
      {!isEditing && (
        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
              <AppText color="#fff" bold variant="caption" style={{ marginLeft: 4 }}>
                保存
              </AppText>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    ...theme.shadows.small,
    position: 'relative',
  },
  editingCard: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  savedCard: {
    opacity: 0.7,
    backgroundColor: '#f6ffed',
  },
  savedOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  confidenceDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  descriptionRow: {
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginLeft: 4,
    minWidth: 60,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
});
