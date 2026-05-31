import { useState } from 'react';
import { Edit2, Loader2, PawPrint, Save, Trash2, X } from 'lucide-react';
import { CurledCorner, Thumbtack } from '../DraftNoteChrome';
import { NOTE_BACKGROUNDS } from '../../constants/draftStyles';
import { commitDrafts } from '../../api/aiDrafts';
import { useDraftStore } from '../../store/useDraftStore';
import type { DraftTransaction } from '../../store/useDraftStore';
import { money } from '../../utils/formatters';

interface AiDraftCardProps {
  draft: DraftTransaction;
  index?: number;
  compact?: boolean;
}

export const AiDraftCard = ({ draft, index = 0, compact = false }: AiDraftCardProps) => {
  const updateDraft = useDraftStore((state) => state.updateDraft);
  const removeDraft = useDraftStore((state) => state.removeDraft);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<DraftTransaction>>(draft);

  const bgClass = NOTE_BACKGROUNDS[index % NOTE_BACKGROUNDS.length];
  const amount = Number(draft.amount || 0);

  const handleSaveEdit = () => {
    updateDraft(draft.id, {
      ...form,
      amount: Number(form.amount || 0),
      type: form.type === 'income' ? 'income' : 'expense',
      currency: form.currency ? String(form.currency).toUpperCase() : null,
    });
    setEditing(false);
  };

  const handleCommit = async () => {
    setSaving(true);
    setError('');
    try {
      await commitDrafts([draft]);
      removeDraft(draft.id);

      // Dispatch global refresh event so other components know to reload ledger data
      window.dispatchEvent(new CustomEvent('ledger-updated'));
    } catch {
      setError('保存失败喵~ 草稿还在这里，主人可以再试一次。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={`cute-sticky-card ${bgClass} relative border border-[#E2CFC2] p-4 shadow-[0_10px_24px_rgba(92,65,45,0.12)] ${
        compact ? 'rounded-[14px]' : 'rounded-[15px]'
      }`}
      style={{
        transform: editing ? 'none' : `rotate(${index % 2 === 0 ? '1.2deg' : '-1.2deg'})`,
      }}
    >
      <Thumbtack />
      <CurledCorner />

      {editing ? (
        <div className="mt-2 flex flex-col gap-2.5 pr-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={form.category || ''}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-md border-2 border-[#4E3629] bg-white px-2 py-1 text-xs font-black text-[#4E3629]"
              placeholder="Category"
            />
            <select
              value={form.type || 'expense'}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as 'income' | 'expense' }))}
              className="w-full rounded-md border-2 border-[#4E3629] bg-white px-2 py-1 text-xs font-black text-[#4E3629]"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <textarea
            value={form.description || ''}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className="w-full resize-none rounded-md border-2 border-[#4E3629] bg-white p-1.5 text-xs font-bold text-[#4E3629]"
            rows={2}
            placeholder="Description"
          />

          <input
            type="date"
            value={form.date || ''}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            className="w-full rounded-md border-2 border-[#4E3629] bg-white p-1 text-xs font-bold text-[#4E3629]"
          />

          <div className="grid grid-cols-[1fr_84px] gap-2">
            <input
              type="number"
              value={form.amount ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) || 0 }))}
              className="w-full rounded-md border-2 border-[#4E3629] bg-white p-1 text-sm font-black text-[#4E3629]"
              step="0.01"
              min="0"
              placeholder="Amount"
            />
            <input
              type="text"
              value={form.currency ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              className="w-full rounded-md border-2 border-[#4E3629] bg-white p-1 text-xs font-bold text-[#4E3629]"
              placeholder="Currency"
              maxLength={8}
            />
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(draft);
                setEditing(false);
              }}
              className="rounded-full border-2 border-[#4E3629] bg-white/70 p-1 text-[#4E3629] hover:bg-white cursor-pointer"
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="rounded-full border-2 border-[#4E3629] bg-emerald-400 p-1 text-white hover:bg-emerald-500 cursor-pointer"
              aria-label="Save draft edit"
            >
              <Save size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[132px] flex-col justify-between pr-2 pt-2">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="max-w-[150px] truncate rounded-full border-2 border-[#4E3629] bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase text-[#4E3629]">
                {draft.category}
              </span>
              <div className="z-10 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setForm(draft);
                    setEditing(true);
                  }}
                  className="rounded-md border-2 border-[#4E3629] bg-white/50 p-1 text-[#4E3629] transition-colors hover:text-blue-600 cursor-pointer"
                  aria-label="Edit draft"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => removeDraft(draft.id)}
                  className="rounded-md border-2 border-[#4E3629] bg-white/50 p-1 text-[#4E3629] transition-colors hover:text-red-500 cursor-pointer"
                  aria-label="Delete draft"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            <h4 className="mt-3 line-clamp-2 text-sm font-bold leading-tight text-[#4E3629]">
              {draft.description}
            </h4>
            {draft.merchant && (
              <p className="mt-1 truncate text-[11px] font-bold text-[#4E3629]/60">
                {draft.merchant}
              </p>
            )}
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#4E3629]/60">{draft.date}</p>
              <p className="mt-0.5 truncate text-lg font-black text-[#4E3629]">
                {draft.currency ? `${draft.currency} ${amount.toFixed(2)}` : money.format(amount)}
              </p>
              {typeof draft.confidence === 'number' && draft.confidence < 0.7 && (
                <p className="mt-0.5 text-[10px] font-black text-[#B7791F]">Low confidence</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleCommit}
              disabled={saving}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#4E3629] bg-white text-[#4E3629] shadow-sm transition-all hover:bg-pink-500 hover:text-white disabled:opacity-60 cursor-pointer"
              aria-label="Confirm draft"
              title="Confirm Draft"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <PawPrint size={14} />}
            </button>
          </div>

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-black text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
};
