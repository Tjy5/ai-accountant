import { beforeEach, describe, expect, it } from 'vitest';
import { useDraftStore } from './useDraftStore';

describe('useDraftStore', () => {
  beforeEach(() => {
    useDraftStore.setState({ drafts: [] });
  });

  it('preserves AI draft metadata fields when adding drafts', () => {
    useDraftStore.getState().addDrafts([
      {
        _draftId: 'ai-draft-1',
        type: 'expense',
        category: '餐饮',
        amount: '18.50',
        currency: 'CNY',
        description: '午餐',
        merchant: 'Codex Cafe',
        sourceText: 'Codex Cafe 午餐 18.50',
        date: '2026-05-28',
        confidence: 0.92,
      },
    ]);

    expect(useDraftStore.getState().drafts[0]).toEqual(expect.objectContaining({
      id: 'ai-draft-1',
      _draftId: 'ai-draft-1',
      amount: 18.5,
      currency: 'CNY',
      merchant: 'Codex Cafe',
      sourceText: 'Codex Cafe 午餐 18.50',
      confidence: 0.92,
    }));
  });
});
