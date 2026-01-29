import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../../theme';
import { AppText } from '../../../components/AppText';
import type { ChatMessage } from '../../../../../shared/types';

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      {!isUser && (
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="robot" size={20} color="#fff" />
        </View>
      )}
      
      <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            isError && styles.errorBubble,
          ]}
        >
          <AppText
            style={[styles.text, isUser && styles.userText]}
            color={isUser ? '#fff' : theme.colors.textPrimary}
          >
            {message.content}
          </AppText>
        </View>
        <View style={[styles.metaRow, isUser && styles.metaRowUser]}>
          <AppText variant="caption" color={theme.colors.textMuted} style={{ fontSize: 11 }}>
            {formatTime(message.timestamp)}
          </AppText>
          {isError && (
            <AppText variant="caption" color={theme.colors.error} style={{ marginLeft: 8 }}>
              发送失败
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
  },
  wrapperUser: {
    justifyContent: 'flex-end',
  },
  wrapperAssistant: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2, // Align with bubble top
  },
  container: {
    maxWidth: '75%',
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderTopRightRadius: 4, // Chat bubble tail effect
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 4, // Chat bubble tail effect
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadows.small,
  },
  errorBubble: {
    backgroundColor: theme.colors.errorContainer || '#ffebee',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  metaRowUser: {
    justifyContent: 'flex-end',
  },
});
