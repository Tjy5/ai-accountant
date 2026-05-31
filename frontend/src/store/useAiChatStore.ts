import { create } from 'zustand';
import { analyzeImageDrafts, analyzeTextDrafts, readFileAsDataUrl } from '../api/aiDrafts';
import { useDraftStore } from './useDraftStore';
import type { AiDraftResponse } from '../types/ai';

export type AiChatRole = 'user' | 'assistant';
export type AiChatMessageStatus = 'sending' | 'sent' | 'failed';

export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  createdAt: number;
  text?: string;
  imagePreviewUrl?: string;
  filename?: string;
  draftIds?: string[];
  warnings?: string[];
  error?: string;
  status?: AiChatMessageStatus;
}

export interface AiChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
}

interface SendImageOptions {
  text?: string;
}

interface AiChatState {
  isOpen: boolean;
  isMinimized: boolean;
  currentSessionId: string | null;
  sessions: AiChatSession[];
  messages: AiChatMessage[];
  pending: boolean;
  error: string;
  open: () => void;
  close: () => void;
  minimize: () => void;
  newConversation: () => void;
  selectConversation: (sessionId: string) => void;
  deleteConversation: (sessionId: string) => void;
  clear: () => void;
  sendText: (text: string) => Promise<void>;
  sendImage: (file: File, options?: SendImageOptions) => Promise<void>;
}

const messageId = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const sessionId = () => `conversation_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024; // 6MB (converts to <= 8MB base64 string for backend validation)
const HISTORY_STORAGE_KEY = 'ai_chat_conversation_history_v1';
const MAX_STORED_SESSIONS = 30;
const MAX_MESSAGES_PER_SESSION = 80;

let requestSequence = 0;

const nextRequestToken = () => {
  requestSequence += 1;
  return requestSequence;
};

const isCurrentRequest = (token: number) => token === requestSequence;

const hasLocalStorage = () => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const normalizeStatus = (status: unknown): AiChatMessageStatus =>
  status === 'sending' || status === 'failed' ? status : 'sent';

const normalizeMessage = (raw: unknown): AiChatMessage | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<AiChatMessage>;
  const role: AiChatRole = value.role === 'user' ? 'user' : 'assistant';
  const createdAt = Number(value.createdAt) || Date.now();
  const id = typeof value.id === 'string' && value.id ? value.id : messageId();

  return {
    id,
    role,
    createdAt,
    text: typeof value.text === 'string' ? value.text : undefined,
    filename: typeof value.filename === 'string' ? value.filename : undefined,
    draftIds: Array.isArray(value.draftIds) ? value.draftIds.map(String) : undefined,
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
    status: normalizeStatus(value.status),
  };
};

const sessionTitleFromMessage = (message?: AiChatMessage) => {
  const source = message?.text || message?.filename || (message?.role === 'assistant' ? message.error : '') || '新对话';
  const compact = source.replace(/\s+/g, ' ').trim() || '新对话';
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact;
};

const normalizeSession = (raw: unknown): AiChatSession | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<AiChatSession>;
  const messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeMessage).filter((message): message is AiChatMessage => Boolean(message))
    : [];

  if (messages.length === 0) return null;

  const createdAt = Number(value.createdAt) || messages[0]?.createdAt || Date.now();
  const updatedAt = Number(value.updatedAt) || messages[messages.length - 1]?.createdAt || createdAt;

  return {
    id: typeof value.id === 'string' && value.id ? value.id : sessionId(),
    title: typeof value.title === 'string' && value.title.trim()
      ? value.title.trim()
      : sessionTitleFromMessage(messages.find((message) => message.role === 'user') || messages[0]),
    createdAt,
    updatedAt,
    messages: messages.slice(-MAX_MESSAGES_PER_SESSION),
  };
};

const sortAndLimitSessions = (sessions: AiChatSession[]) =>
  [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_STORED_SESSIONS);

const saveHistory = (sessions: AiChatSession[], currentSessionId: string | null) => {
  if (!hasLocalStorage()) return;

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      currentSessionId,
      sessions: sortAndLimitSessions(sessions).map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map(normalizeMessage).filter(Boolean),
      })),
    }));
  } catch {
    return;
  }
};

type ChatHistoryState = Pick<AiChatState, 'sessions' | 'currentSessionId' | 'messages'>;

const historyStateFromSessions = (
  sessions: AiChatSession[],
  requestedSessionId: string | null,
): ChatHistoryState => {
  const nextSessions = sortAndLimitSessions(sessions);
  const currentSessionId = requestedSessionId && nextSessions.some((session) => session.id === requestedSessionId)
    ? requestedSessionId
    : null;
  const messages = nextSessions.find((session) => session.id === currentSessionId)?.messages || [];

  saveHistory(nextSessions, currentSessionId);

  return {
    sessions: nextSessions,
    currentSessionId,
    messages,
  };
};

const loadStoredHistory = (): ChatHistoryState => {
  if (!hasLocalStorage()) {
    return { sessions: [], currentSessionId: null, messages: [] };
  }

  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) {
      return { sessions: [], currentSessionId: null, messages: [] };
    }

    const parsed = JSON.parse(stored) as { currentSessionId?: unknown; sessions?: unknown };
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.map(normalizeSession).filter((session): session is AiChatSession => Boolean(session))
      : [];
    const requestedSessionId = typeof parsed.currentSessionId === 'string' ? parsed.currentSessionId : null;

    return historyStateFromSessions(sessions, requestedSessionId);
  } catch {
    return { sessions: [], currentSessionId: null, messages: [] };
  }
};

const appendMessagesToCurrentConversation = (
  state: AiChatState,
  messages: AiChatMessage[],
) => {
  const now = Date.now();
  let targetSessionId = state.currentSessionId && state.sessions.some((session) => session.id === state.currentSessionId)
    ? state.currentSessionId
    : null;
  let sessions = state.sessions;

  if (!targetSessionId) {
    targetSessionId = sessionId();
    const firstMessage = messages.find((message) => message.role === 'user') || messages[0];
    sessions = [{
      id: targetSessionId,
      title: sessionTitleFromMessage(firstMessage),
      createdAt: now,
      updatedAt: now,
      messages: [],
    }, ...sessions];
  }

  const nextSessions = sessions.map((conversation) => {
    if (conversation.id !== targetSessionId) return conversation;

    const nextMessages = [...conversation.messages, ...messages].slice(-MAX_MESSAGES_PER_SESSION);
    const firstUserMessage = nextMessages.find((message) => message.role === 'user');

    return {
      ...conversation,
      title: conversation.messages.length === 0 ? sessionTitleFromMessage(firstUserMessage || nextMessages[0]) : conversation.title,
      updatedAt: now,
      messages: nextMessages,
    };
  });

  return {
    sessionId: targetSessionId,
    history: historyStateFromSessions(nextSessions, targetSessionId),
  };
};

const appendMessagesToConversation = (
  state: AiChatState,
  targetSessionId: string,
  messages: AiChatMessage[],
) => {
  const now = Date.now();
  const nextSessions = state.sessions.map((conversation) => (
    conversation.id === targetSessionId
      ? {
        ...conversation,
        updatedAt: now,
        messages: [...conversation.messages, ...messages].slice(-MAX_MESSAGES_PER_SESSION),
      }
      : conversation
  ));

  return historyStateFromSessions(nextSessions, state.currentSessionId);
};

const userTextMessage = (text: string): AiChatMessage => ({
  id: messageId(),
  role: 'user',
  text,
  createdAt: Date.now(),
  status: 'sent',
});

const userImageMessage = (file: File, text?: string): AiChatMessage => ({
  id: messageId(),
  role: 'user',
  text,
  filename: file.name,
  imagePreviewUrl: URL.createObjectURL(file),
  createdAt: Date.now(),
  status: 'sent',
});

const assistantMessageFromResponse = (response: AiDraftResponse): AiChatMessage => {
  const normalizedDrafts = useDraftStore.getState().addDrafts(response.drafts || []);
  const reply = response.reply
    || response.clarificationQuestion
    || (normalizedDrafts.length > 0
      ? `好棒喵！本喵帮主人认出了 ${normalizedDrafts.length} 笔账单草稿，快看看对不对喵~`
      : '本喵还需要更多信息喵~ 可以告诉本喵金额和用途吗？');

  return {
    id: messageId(),
    role: 'assistant',
    text: reply,
    draftIds: normalizedDrafts.map((draft) => draft.id),
    warnings: response.warnings || [],
    createdAt: Date.now(),
    status: 'sent',
  };
};

const assistantErrorMessage = (error: string): AiChatMessage => ({
  id: messageId(),
  role: 'assistant',
  text: error,
  error,
  createdAt: Date.now(),
  status: 'failed',
});

const errorMessage = (error: unknown, fallback: string) => {
  const maybe = error as { response?: { data?: { error?: string } }; message?: string };
  return maybe.response?.data?.error || maybe.message || fallback;
};

const storedHistory = loadStoredHistory();

export const useAiChatStore = create<AiChatState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  currentSessionId: storedHistory.currentSessionId,
  sessions: storedHistory.sessions,
  messages: storedHistory.messages,
  pending: false,
  error: '',

  open: () => set({ isOpen: true, isMinimized: false }),
  close: () => set({ isOpen: false, isMinimized: false, error: '' }),
  minimize: () => set({ isOpen: true, isMinimized: true }),
  newConversation: () => set((state) => ({
    ...historyStateFromSessions(state.sessions, null),
    isOpen: true,
    isMinimized: false,
    error: '',
  })),
  selectConversation: (conversationId) => set((state) => ({
    ...historyStateFromSessions(state.sessions, conversationId),
    isOpen: true,
    isMinimized: false,
    error: '',
  })),
  deleteConversation: (conversationId) => set((state) => {
    const nextSessions = state.sessions.filter((conversation) => conversation.id !== conversationId);
    const nextSessionId = state.currentSessionId === conversationId
      ? nextSessions[0]?.id || null
      : state.currentSessionId;

    return {
      ...historyStateFromSessions(nextSessions, nextSessionId),
      error: '',
    };
  }),
  clear: () => {
    requestSequence += 1;

    // Clean up local object URLs to prevent memory leaks
    get().messages.forEach((msg) => {
      if (msg.imagePreviewUrl) {
        try {
          URL.revokeObjectURL(msg.imagePreviewUrl);
        } catch (e) {
          console.error('Failed to revoke object URL', e);
        }
      }
    });
    set((state) => ({
      ...historyStateFromSessions(
        state.currentSessionId
          ? state.sessions.filter((conversation) => conversation.id !== state.currentSessionId)
          : state.sessions,
        null,
      ),
      error: '',
      pending: false,
    }));
  },

  sendText: async (rawText) => {
    const text = rawText.trim();
    if (!text || get().pending) return;
    const requestToken = nextRequestToken();
    const userMessage = userTextMessage(text);
    let requestSessionId = '';

    set((state) => ({
      ...(() => {
        const next = appendMessagesToCurrentConversation(state, [userMessage]);
        requestSessionId = next.sessionId;
        return next.history;
      })(),
      isOpen: true,
      isMinimized: false,
      pending: true,
      error: '',
    }));

    try {
      const response = await analyzeTextDrafts(text);
      if (!isCurrentRequest(requestToken)) return;
      set((state) => ({
        ...appendMessagesToConversation(state, requestSessionId, [assistantMessageFromResponse(response)]),
      }));
    } catch (error) {
      if (!isCurrentRequest(requestToken)) return;
      const message = errorMessage(error, '本喵暂时没能分析这笔账单喵~ 主人稍后再试一下好吗？');
      set((state) => ({
        error: message,
        ...appendMessagesToConversation(state, requestSessionId, [assistantErrorMessage(message)]),
      }));
    } finally {
      if (isCurrentRequest(requestToken)) {
        set({ pending: false });
      }
    }
  },

  sendImage: async (file, options = {}) => {
    if (get().pending) return;

    // Validate MIME type
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      const message = '本喵只能识别图片账单喵~ 请上传 PNG、JPG 或 WebP 图片。';
      set((state) => ({
        ...appendMessagesToCurrentConversation(state, [assistantErrorMessage(message)]).history,
        isOpen: true,
        isMinimized: false,
        error: message,
      }));
      return;
    }

    // Validate file size (under 6MB to fit backend's 8MB base64 limit)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const message = '图片太大了喵！上传的图片不能超过 6MB 喵。';
      set((state) => ({
        ...appendMessagesToCurrentConversation(state, [assistantErrorMessage(message)]).history,
        isOpen: true,
        isMinimized: false,
        error: message,
      }));
      return;
    }

    const requestToken = nextRequestToken();
    const userMessage = userImageMessage(file, options.text?.trim());
    let requestSessionId = '';

    set((state) => ({
      ...(() => {
        const next = appendMessagesToCurrentConversation(state, [userMessage]);
        requestSessionId = next.sessionId;
        return next.history;
      })(),
      isOpen: true,
      isMinimized: false,
      pending: true,
      error: '',
    }));

    try {
      const image = await readFileAsDataUrl(file);
      if (!isCurrentRequest(requestToken)) return;
      const response = await analyzeImageDrafts(image, { filename: file.name, text: options.text });
      if (!isCurrentRequest(requestToken)) return;
      set((state) => ({
        ...appendMessagesToConversation(state, requestSessionId, [assistantMessageFromResponse(response)]),
      }));
    } catch (error) {
      if (!isCurrentRequest(requestToken)) return;
      const message = errorMessage(error, '本喵暂时没能看清这张账单喵~ 主人可以换张清晰一点的图片再试试。');
      set((state) => ({
        error: message,
        ...appendMessagesToConversation(state, requestSessionId, [assistantErrorMessage(message)]),
      }));
    } finally {
      if (isCurrentRequest(requestToken)) {
        set({ pending: false });
      }
    }
  },
}));
