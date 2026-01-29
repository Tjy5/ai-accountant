import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../../theme';
import { AppText } from '../../components/AppText';
import { useAuth } from '../../auth/AuthContext';
import { createLocalTransactions } from '../../storage/localDB';
import { enqueueMany } from '../../sync/offlineQueue';
import { api, getApiErrorMessage } from '../../../../shared/utils/api';
import type {
  ChatMessage,
  ChatTransactionDraft,
  ChatRequest,
  ChatResponse,
  Category,
} from '../../../../shared/types';

import ChatBubble from './components/ChatBubble';
import DraftCard from './components/DraftCard';

export default function AIChatScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Typing animation values
  const dot1Op = useRef(new Animated.Value(0.3)).current;
  const dot2Op = useRef(new Animated.Value(0.3)).current;
  const dot3Op = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isLoading) {
      const anim = Animated.loop(
        Animated.stagger(150, [
          Animated.sequence([
            Animated.timing(dot1Op, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot1Op, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(dot2Op, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot2Op, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(dot3Op, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(dot3Op, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isLoading]);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get<{ categories: Category[] }>('/api/categories');
      setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  };

  const addMessage = useCallback((
    role: 'user' | 'assistant',
    content: string,
    drafts?: ChatTransactionDraft[]
  ) => {
    const newMessage: ChatMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: new Date(),
      drafts,
      status: role === 'user' ? 'sending' : 'sent',
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessageStatus = useCallback((
    messageId: string,
    status: 'sending' | 'sent' | 'error'
  ) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, status } : msg
    ));
  }, []);

  const markDraftSaved = useCallback((messageId: string, draftId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId || !msg.drafts) return msg;
      return {
        ...msg,
        drafts: msg.drafts.map(draft =>
          draft._draftId === draftId ? { ...draft, saved: true } : draft
        ),
      };
    }));
  }, []);

  const markDraftSuperseded = useCallback((draftId: string) => {
    setMessages(prev => prev.map(msg => {
      if (!msg.drafts) return msg;
      return {
        ...msg,
        drafts: msg.drafts.map(draft =>
          draft._draftId === draftId ? { ...draft, superseded: true } : draft
        ),
      };
    }));
  }, []);

  const removeDraft = useCallback((messageId: string, draftId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId || !msg.drafts) return msg;
      return {
        ...msg,
        drafts: msg.drafts.filter(draft => draft._draftId !== draftId),
      };
    }));
  }, []);

  const getPendingDrafts = useCallback((): ChatTransactionDraft[] => {
    const pending: ChatTransactionDraft[] = [];
    messages.forEach(msg => {
      if (msg.drafts) {
        msg.drafts.forEach(draft => {
          if (!draft.saved && !draft.superseded) {
            pending.push(draft);
          }
        });
      }
    });
    return pending;
  }, [messages]);

  const getMessagesForApi = useCallback(() => {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }, [messages]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    const userMsgId = addMessage('user', text);
    setIsLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const pendingDrafts = getPendingDrafts();
      const chatRequest: ChatRequest = {
        messages: [
          ...getMessagesForApi(),
          { role: 'user', content: text },
        ],
        clientContext: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: 'zh-CN',
          now: new Date().toISOString(),
        },
        pendingDrafts: pendingDrafts.length > 0 ? pendingDrafts : undefined,
      };

      const response: ChatResponse = await api.post<ChatResponse>('/api/ai/chat', chatRequest);

      updateMessageStatus(userMsgId, 'sent');

      // If this is an update_draft intent, mark old drafts as superseded
      if (response.intent === 'update_draft' && response.drafts.length > 0) {
        pendingDrafts.forEach(draft => {
          markDraftSuperseded(draft._draftId);
        });
      }

      // Add AI message with drafts
      addMessage('assistant', response.reply, response.drafts);

      // Show warnings if any
      if (response.warnings && response.warnings.length > 0) {
        response.warnings.forEach(warning => {
          Alert.alert('提示', warning);
        });
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error: any) {
      updateMessageStatus(userMsgId, 'error');

      if (error.status === 401) {
        Alert.alert('错误', '请先登录');
      } else if (error.status === 429) {
        Alert.alert('错误', '请求过于频繁，请稍后再试');
      } else if (error.status === 502 || error.status === 503) {
        Alert.alert('错误', 'AI 服务暂时不可用');
      } else {
        Alert.alert('错误', getApiErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async (messageId: string, draft: ChatTransactionDraft) => {
    if (!user) {
      Alert.alert('错误', '请先登录');
      return;
    }

    try {
      const item = {
        type: draft.type,
        category: draft.category,
        amount: draft.amount,
        description: draft.description,
        date: draft.date,
      };

      // Save locally and queue for sync
      const created = await createLocalTransactions(user.id, [item]);
      await enqueueMany(user.id, 'transactions', 'upsert', created);

      markDraftSaved(messageId, draft._draftId);
      Alert.alert('成功', '已保存到本地（待同步）');
    } catch (err) {
      Alert.alert('保存失败', getApiErrorMessage(err));
    }
  };

  const handleDiscardDraft = (messageId: string, draftId: string) => {
    removeDraft(messageId, draftId);
  };

  const clearChat = () => {
    Alert.alert(
      '清空对话',
      '确定要清空所有对话记录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            api.post('/api/ai/chat', { messages: [], clearContext: true }).catch(() => {});
          },
        },
      ]
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return (
      <View style={styles.messageContainer}>
        <ChatBubble message={item} />
        {item.drafts && item.drafts.length > 0 && (
          <View style={styles.draftsContainer}>
            {item.drafts
              .filter(d => !d.superseded)
              .map(draft => (
                <DraftCard
                  key={draft._draftId}
                  draft={draft}
                  categories={categories}
                  onSave={() => handleSaveDraft(item.id, draft)}
                  onDiscard={() => handleDiscardDraft(item.id, draft._draftId)}
                />
              ))}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="robot-happy-outline"
        size={64}
        color={theme.colors.textMuted}
      />
      <AppText variant="title" style={styles.emptyTitle}>
        AI 智能记账助手
      </AppText>
      <AppText variant="caption" color={theme.colors.textSecondary} centered>
        试试说 "今天午饭花了50" 或 "打车35元"
      </AppText>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>
        <AppText variant="title" bold>AI 聊天记账</AppText>
        <Pressable onPress={clearChat} hitSlop={10} disabled={messages.length === 0}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={24}
            color={messages.length === 0 ? theme.colors.textMuted : theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.messagesListEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
      />

      {/* Typing Indicator */}
      {isLoading && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <Animated.View style={[styles.dot, { opacity: dot1Op }]} />
            <Animated.View style={[styles.dot, { opacity: dot2Op }]} />
            <Animated.View style={[styles.dot, { opacity: dot3Op }]} />
          </View>
        </View>
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入消息..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={2000}
            editable={!isLoading}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messagesListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  messageContainer: {
    marginBottom: 12,
  },
  draftsContainer: {
    marginTop: 8,
    marginLeft: 8,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
});
