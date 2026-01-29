import { useCallback } from 'react';
import { message } from 'antd';
import api from '../../../utils/api';
import type { ChatRequest, ChatResponse, ChatTransactionDraft } from '../../../../../shared/types';
import type { UseChatStateReturn } from './useChatState';

interface UseAIChatOptions {
  chatState: UseChatStateReturn;
  onTransactionSaved?: () => void;
}

export function useAIChat({ chatState, onTransactionSaved }: UseAIChatOptions) {
  const {
    addMessage,
    updateMessageStatus,
    getPendingDrafts,
    markDraftSuperseded,
    getMessagesForApi,
    setIsLoading,
    clearAll,
  } = chatState;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMsgId = addMessage('user', text);
    setIsLoading(true);

    try {
      // Build request
      const pendingDrafts = getPendingDrafts();
      const chatRequest: ChatRequest = {
        messages: [
          ...getMessagesForApi(),
          { role: 'user', content: text },
        ],
        clientContext: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          now: new Date().toISOString(),
        },
        pendingDrafts: pendingDrafts.length > 0 ? pendingDrafts : undefined,
      };

      // Call API
      const response: ChatResponse = await api.chat(chatRequest);

      // Update user message status
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
          message.warning(warning);
        });
      }

      return response;
    } catch (error: any) {
      updateMessageStatus(userMsgId, 'error');

      if (error.status === 401) {
        message.error('请先登录');
      } else if (error.status === 429) {
        message.error('请求过于频繁，请稍后再试');
      } else if (error.status === 502 || error.status === 503) {
        message.error('AI 服务暂时不可用');
      } else {
        message.error(error.message || '发送失败');
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, updateMessageStatus, getPendingDrafts, markDraftSuperseded, getMessagesForApi, setIsLoading]);

  const saveTransaction = useCallback(async (draft: ChatTransactionDraft) => {
    try {
      await api.post('/api/transactions', {
        type: draft.type,
        category: draft.category,
        amount: draft.amount,
        description: draft.description,
        date: draft.date,
        tags: draft.tags || [],
      });
      message.success('保存成功');
      onTransactionSaved?.();
      return true;
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
      return false;
    }
  }, [onTransactionSaved]);

  const saveAllTransactions = useCallback(async (drafts: ChatTransactionDraft[]) => {
    try {
      const transactions = drafts.map(draft => ({
        type: draft.type,
        category: draft.category,
        amount: draft.amount,
        description: draft.description,
        date: draft.date,
        tags: draft.tags || [],
      }));
      await api.bulkCreateTransactions(transactions);
      message.success(`成功保存 ${drafts.length} 笔交易`);
      onTransactionSaved?.();
      return true;
    } catch (error: any) {
      message.error(`批量保存失败: ${error.message}`);
      return false;
    }
  }, [onTransactionSaved]);

  const clearContext = useCallback(async () => {
    try {
      await api.clearChatContext();
      clearAll();
      message.success('对话已清空');
    } catch (error: any) {
      message.error('清空失败');
    }
  }, [clearAll]);

  return {
    sendMessage,
    saveTransaction,
    saveAllTransactions,
    clearContext,
  };
}

export type UseAIChatReturn = ReturnType<typeof useAIChat>;
