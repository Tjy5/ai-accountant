import { useState, useCallback } from 'react';
import type { ChatMessage, ChatTransactionDraft } from '../../../../../shared/types';

export function useChatState() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = useCallback((
    role: 'user' | 'assistant',
    content: string,
    drafts?: ChatTransactionDraft[]
  ) => {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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

  const updateMessageDrafts = useCallback((
    messageId: string,
    drafts: ChatTransactionDraft[]
  ) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, drafts } : msg
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

  const clearAll = useCallback(() => {
    setMessages([]);
  }, []);

  const getMessagesForApi = useCallback(() => {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }, [messages]);

  return {
    messages,
    isLoading,
    setIsLoading,
    addMessage,
    updateMessageStatus,
    updateMessageDrafts,
    markDraftSaved,
    markDraftSuperseded,
    removeDraft,
    getPendingDrafts,
    clearAll,
    getMessagesForApi,
  };
}

export type UseChatStateReturn = ReturnType<typeof useChatState>;
