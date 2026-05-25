import { create } from 'zustand';

export interface DraftTransaction {
  id: string;
  _draftId?: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  type: 'expense' | 'income';
  confidence?: number;
  confirmed?: boolean;
}

export type DraftInput = Partial<Omit<DraftTransaction, 'type' | 'amount'>> & {
  amount?: number | string;
  type?: string;
};

interface DraftState {
  drafts: DraftTransaction[];
  addDrafts: (newDrafts: DraftInput[]) => void;
  updateDraft: (id: string, updatedDraft: Partial<DraftTransaction>) => void;
  removeDraft: (id: string) => void;
  clearDrafts: () => void;
}

const fallbackDraftId = (index: number) => `draft_${Date.now()}_${index}_${Math.random().toString(36).slice(2)}`;

const normalizeDraft = (draft: DraftInput, index: number): DraftTransaction => ({
  ...draft,
  id: String(draft.id || draft._draftId || fallbackDraftId(index)),
  _draftId: draft._draftId,
  date: draft.date || new Date().toISOString().split('T')[0],
  amount: Number(draft.amount || 0),
  category: draft.category || 'Uncategorized',
  description: draft.description || 'Untitled transaction',
  type: draft.type === 'income' ? 'income' : 'expense',
});

export const useDraftStore = create<DraftState>((set) => ({
  drafts: [],
  addDrafts: (newDrafts) => set((state) => ({
    drafts: [...state.drafts, ...newDrafts.map((draft, index) => normalizeDraft(draft, index))]
  })),
  updateDraft: (id, updatedDraft) => set((state) => ({
    drafts: state.drafts.map((draft) => 
      draft.id === id ? { ...draft, ...updatedDraft } : draft
    )
  })),
  removeDraft: (id) => set((state) => ({
    drafts: state.drafts.filter((draft) => draft.id !== id)
  })),
  clearDrafts: () => set({ drafts: [] }),
}));
