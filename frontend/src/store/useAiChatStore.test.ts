import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeTextDrafts } from '../api/aiDrafts';
import type { AiDraftResponse } from '../types/ai';
import { useAiChatStore } from './useAiChatStore';
import { useDraftStore } from './useDraftStore';

vi.mock('../api/aiDrafts', () => ({
  analyzeTextDrafts: vi.fn(),
  analyzeImageDrafts: vi.fn(),
  readFileAsDataUrl: vi.fn(),
}));

describe('useAiChatStore', () => {
  beforeEach(() => {
    vi.mocked(analyzeTextDrafts).mockReset();
    useAiChatStore.setState({
      isOpen: false,
      isMinimized: false,
      currentSessionId: null,
      sessions: [],
      messages: [],
      pending: false,
      error: '',
    });
    useDraftStore.setState({ drafts: [] });
  });

  it('clears chat messages without deleting existing drafts', () => {
    const [draft] = useDraftStore.getState().addDrafts([
      {
        _draftId: 'draft-to-review',
        type: 'expense',
        category: 'Food',
        amount: 12,
        description: 'Snack',
        date: '2026-05-31',
      },
    ]);

    useAiChatStore.setState({
      messages: [
        {
          id: 'message-with-draft',
          role: 'assistant',
          createdAt: 1,
          draftIds: [draft.id],
          status: 'sent',
        },
      ],
    });

    useAiChatStore.getState().clear();

    expect(useAiChatStore.getState().messages).toEqual([]);
    expect(useDraftStore.getState().drafts).toEqual([draft]);
  });

  it('ignores a pending text analysis response after clearing chat', async () => {
    let resolveResponse: (response: AiDraftResponse) => void = () => undefined;
    vi.mocked(analyzeTextDrafts).mockImplementation(() => new Promise((resolve) => {
      resolveResponse = resolve;
    }));

    const sendPromise = useAiChatStore.getState().sendText('Coffee 5');

    expect(useAiChatStore.getState().pending).toBe(true);
    expect(useAiChatStore.getState().messages).toHaveLength(1);

    useAiChatStore.getState().clear();

    expect(useAiChatStore.getState().pending).toBe(false);
    expect(useAiChatStore.getState().messages).toEqual([]);

    resolveResponse({
      reply: 'Draft ready',
      drafts: [
        {
          _draftId: 'late-draft',
          type: 'expense',
          category: 'Food',
          amount: 5,
          description: 'Coffee',
          date: '2026-05-31',
        },
      ],
    });
    await sendPromise;

    expect(useAiChatStore.getState().messages).toEqual([]);
    expect(useDraftStore.getState().drafts).toEqual([]);
  });

  it('creates, switches, and deletes conversation history', async () => {
    vi.mocked(analyzeTextDrafts)
      .mockResolvedValueOnce({ reply: 'Coffee draft ready', drafts: [] })
      .mockResolvedValueOnce({ reply: 'Taxi draft ready', drafts: [] });

    await useAiChatStore.getState().sendText('Coffee 5');

    const firstSessionId = useAiChatStore.getState().currentSessionId;
    expect(firstSessionId).toBeTruthy();
    expect(useAiChatStore.getState().sessions).toHaveLength(1);
    expect(useAiChatStore.getState().sessions[0].title).toBe('Coffee 5');
    expect(useAiChatStore.getState().messages.map((message) => message.text)).toEqual([
      'Coffee 5',
      'Coffee draft ready',
    ]);

    useAiChatStore.getState().newConversation();
    expect(useAiChatStore.getState().currentSessionId).toBeNull();
    expect(useAiChatStore.getState().messages).toEqual([]);

    await useAiChatStore.getState().sendText('Taxi 22');

    const secondSessionId = useAiChatStore.getState().currentSessionId;
    expect(secondSessionId).toBeTruthy();
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(useAiChatStore.getState().sessions).toHaveLength(2);

    useAiChatStore.getState().selectConversation(firstSessionId || '');
    expect(useAiChatStore.getState().currentSessionId).toBe(firstSessionId);
    expect(useAiChatStore.getState().messages.map((message) => message.text)).toEqual([
      'Coffee 5',
      'Coffee draft ready',
    ]);

    useAiChatStore.getState().deleteConversation(firstSessionId || '');
    expect(useAiChatStore.getState().sessions).toHaveLength(1);
    expect(useAiChatStore.getState().sessions[0].id).toBe(secondSessionId);
    expect(useAiChatStore.getState().currentSessionId).toBe(secondSessionId);
  });

  it('persists serializable conversation history locally', async () => {
    vi.mocked(analyzeTextDrafts).mockResolvedValue({
      reply: 'Draft ready',
      warnings: ['Fallback parser used'],
      drafts: [],
    });

    await useAiChatStore.getState().sendText('Lunch 38');

    const stored = JSON.parse(localStorage.getItem('ai_chat_conversation_history_v1') || '{}');

    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0].title).toBe('Lunch 38');
    expect(stored.sessions[0].messages.map((message: { text?: string }) => message.text)).toEqual([
      'Lunch 38',
      'Draft ready',
    ]);
    expect(stored.currentSessionId).toBe(useAiChatStore.getState().currentSessionId);
  });
});
