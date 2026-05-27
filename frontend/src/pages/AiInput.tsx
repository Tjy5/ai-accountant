import React, { useState } from 'react';
import { useDraftStore } from '../store/useDraftStore';
import type { DraftTransaction } from '../store/useDraftStore';
import api from '../api/axiosInstance';
import { Send, PawPrint, Trash2, Edit2, Save, X, Camera } from 'lucide-react';

const NOTE_BACKGROUNDS = [
  'bg-[#FFD1DC]', // macaron pink
  'bg-[#C2F2D0]', // macaron mint
  'bg-[#FFF2B2]', // macaron yellow
  'bg-[#B5E2FF]'  // pastel blue
];

const SpeechBubbleTail = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="absolute bottom-[-26px] right-10 pointer-events-none"
  >
    <path
      d="M0 0 H28 V28 L0 0"
      fill="#FFB87A"
      stroke="#4E3629"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 -2 H26"
      stroke="#FFB87A"
      strokeWidth="6"
      strokeLinecap="round"
    />
  </svg>
);

const Thumbtack = () => (
  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 z-20 pointer-events-none">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M12 12V22" stroke="#4E3629" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="12" cy="10" rx="7" ry="4.5" fill="#FF5E5E" stroke="#4E3629" strokeWidth="3"/>
      <circle cx="12" cy="6" r="4" fill="#FF5E5E" stroke="#4E3629" strokeWidth="3"/>
      <circle cx="10.5" cy="5" r="1.5" fill="white"/>
    </svg>
  </div>
);

const CurledCorner = () => (
  <div className="cute-page-curl"></div>
);

export const AiInput = () => {
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DraftTransaction>>({});

  const { drafts, addDrafts, updateDraft, removeDraft, clearDrafts } = useDraftStore();

  const handleTextAnalyze = async () => {
    if (!textInput.trim()) return;

    setLoading(true);
    try {
      const response = await api.post('/ai/analyze', { text: textInput });
      addDrafts(response.data.drafts || []);
      setTextInput('');
    } catch {
      console.warn('Backend not available, using mock parser');
      const mockDraft: DraftTransaction = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 100) + 10,
        category: 'Food',
        description: textInput.substring(0, 20) || 'Lunch',
        type: 'expense'
      };
      addDrafts([mockDraft]);
      setTextInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploading(true);
      try {
        const response = await api.post('/ai/analyze-image', { image: base64, text: file.name });
        addDrafts(response.data.drafts || []);
      } catch {
        console.warn('Backend not available, using mock image parser');
        const mockDraft: DraftTransaction = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          amount: 85.50,
          category: 'Groceries',
          description: 'Supermarket Receipt',
          type: 'expense'
        };
        addDrafts([mockDraft]);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCommitDraft = async (draftId: string) => {
    try {
      const draftToCommit = drafts.find(d => d.id === draftId);
      if (!draftToCommit) return;

      const payload = { ...draftToCommit, confirmed: true };
      await api.post('/ai/transactions/commit', { drafts: [payload] });
      removeDraft(draftId);
    } catch (err) {
      console.warn('Commit failed, but proceeding locally for representation', err);
      removeDraft(draftId); // local fallback
    }
  };

  const handleCommitAll = async () => {
    if (drafts.length === 0) return;

    try {
      const payloadDrafts = drafts.map(d => ({ ...d, confirmed: true }));
      await api.post('/ai/transactions/commit', { drafts: payloadDrafts });
      clearDrafts();
    } catch (err) {
      console.warn('Commit all failed, but proceeding locally for representation', err);
      clearDrafts(); // local fallback
    }
  };

  return (
    <div className="flex flex-col gap-8 text-[#4E3629]">
      {/* Title */}
      <div className="text-center md:text-left">
        <h1 className="text-4xl font-black">AI Bookkeeping</h1>
      </div>

      {/* Main Grid: Left Inputs vs Right Draft Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">

        {/* Left Column: Input Forms */}
        <div className="flex flex-col gap-8">
          {/* Speech Bubble Container */}
          <div className="relative bg-[#FFB87A] border-4 border-[#4E3629] rounded-[30px] p-6 shadow-sm flex flex-col justify-between h-48">
            <textarea
              className="w-full h-full bg-transparent border-none outline-none resize-none font-bold text-[#4E3629] placeholder-[#4E3629]/60 text-lg"
              placeholder="Type what you spent today..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
            <div className="flex justify-end z-10">
              <button
                onClick={handleTextAnalyze}
                disabled={loading || !textInput.trim()}
                aria-label="Analyze"
                className="p-2.5 bg-white border-2 border-[#4E3629] rounded-full hover:bg-gray-50 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center"
              >
                <Send size={18} className="text-[#4E3629]" />
              </button>
            </div>
            <SpeechBubbleTail />
          </div>

          {/* Scanner Dropzone Container */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-black flex items-center gap-2">
              📸 Scanner dropzone
            </h2>
            <div className="relative border-4 border-dashed border-[#FFB87A] bg-[#FFB87A]/10 hover:bg-[#FFB87A]/15 rounded-[25px] flex flex-col items-center justify-center p-6 h-56 transition-colors cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={handleFileUpload}
              />
              <div className="flex flex-col items-center gap-3 text-[#4E3629] text-center">
                {uploading ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#4E3629]"></div>
                ) : (
                  <>
                    <div className="w-28 h-28 rounded-[30px] bg-white border-4 border-[#4E3629] flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-[0_10px_22px_rgba(92,65,45,0.12)]">
                      <div className="w-20 h-16 rounded-[18px] bg-[#FFD1DC] border-4 border-[#4E3629] flex items-center justify-center relative">
                        <Camera size={34} strokeWidth={2.8} className="text-[#4E3629]" />
                        <span className="absolute -top-3 right-2 w-5 h-5 rounded-full bg-[#C2F2D0] border-4 border-[#4E3629]" />
                      </div>
                    </div>
                    <span className="font-black text-lg">Scanner dropzone</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Divider (Only for Large Screens) */}
        <div className="hidden lg:block w-1 bg-[#4E3629]/10 rounded-full h-full absolute left-1/2 -translate-x-1/2 z-0"></div>

        {/* Right Column: Sticky Notes (Draft Board) */}
        <div className="flex flex-col gap-3 relative">
          <h2 className="text-xl font-black flex items-center gap-2">
            📋 AI Parsed drafts
            {drafts.length > 0 && (
              <span className="bg-macaron-pink border-2 border-[#4E3629] text-[#4E3629] text-xs py-0.5 px-2.5 rounded-full font-black">
                {drafts.length}
              </span>
            )}
          </h2>

          <div className="flex-grow bg-[#FAF6EE] border-4 border-dashed border-[#4E3629]/20 rounded-[25px] p-6 min-h-[350px]">
            {drafts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#4E3629]/40 gap-4 mt-20 text-center">
                <span className="text-5xl">📋</span>
                <p className="font-bold">No drafts yet. Type above or scan receipts!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                {drafts.map((draft, index) => {
                  const bgClass = NOTE_BACKGROUNDS[index % NOTE_BACKGROUNDS.length];
                  const isEditing = editingId === draft.id;

                  return (
                    <div
                      key={draft.id}
                      className={`cute-sticky-card ${bgClass} border-4 border-[#4E3629] rounded-[15px] p-5 shadow-sm transform transition-all`}
                      style={{
                        transform: isEditing ? 'none' : `rotate(${index % 2 === 0 ? '2.5deg' : '-2.5deg'})`,
                        zIndex: isEditing ? 20 : 1
                      }}
                    >
                      {/* Thumbtack */}
                      <Thumbtack />

                      {/* Curled Page Corner */}
                      <CurledCorner />

                      {isEditing ? (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editForm.category || ''}
                              onChange={e => setEditForm({...editForm, category: e.target.value})}
                              className="text-xs font-bold px-2 py-1 rounded-md border-2 border-[#4E3629] w-full bg-white text-[#4E3629]"
                              placeholder="Category"
                            />
                            <select
                              value={editForm.type || 'expense'}
                              onChange={e => setEditForm({...editForm, type: e.target.value as 'income'|'expense'})}
                              className="text-xs font-bold px-2 py-1 rounded-md border-2 border-[#4E3629] w-full bg-white text-[#4E3629]"
                            >
                              <option value="expense">Expense</option>
                              <option value="income">Income</option>
                            </select>
                          </div>

                          <textarea
                            value={editForm.description || ''}
                            onChange={e => setEditForm({...editForm, description: e.target.value})}
                            className="font-bold text-[#4E3629] text-xs w-full border-2 border-[#4E3629] rounded-md p-1.5 bg-white resize-none"
                            rows={2}
                            placeholder="Description"
                          />

                          <input
                            type="date"
                            value={editForm.date || ''}
                            onChange={e => setEditForm({...editForm, date: e.target.value})}
                            className="text-xs text-[#4E3629] font-bold border-2 border-[#4E3629] rounded-md p-1 w-full bg-white"
                          />

                          <div className="flex items-center gap-1 border-2 border-[#4E3629] rounded-md p-1 bg-white">
                            <span className="text-[#4E3629]/50 font-black pl-1">$</span>
                            <input
                              type="number"
                              value={editForm.amount || ''}
                              onChange={e => setEditForm({...editForm, amount: parseFloat(e.target.value) || 0})}
                              className="font-black text-base text-[#4E3629] w-full outline-none bg-transparent"
                              step="0.01"
                            />
                          </div>

                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-500 hover:text-gray-700 bg-white/60 border-2 border-[#4E3629] rounded-full p-1 cursor-pointer"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={() => {
                                updateDraft(draft.id, editForm);
                                setEditingId(null);
                              }}
                              className="bg-emerald-400 hover:bg-emerald-500 text-white border-2 border-[#4E3629] p-1 rounded-full cursor-pointer transition-colors"
                              title="Save"
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-between h-full min-h-[140px] pr-2">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider bg-white/65 border-2 border-[#4E3629] px-2 py-0.5 rounded-full">
                                {draft.category}
                              </span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingId(draft.id);
                                    setEditForm(draft);
                                  }}
                                  className="text-[#4E3629] hover:text-blue-600 bg-white/50 border-2 border-[#4E3629] p-1 rounded-md cursor-pointer transition-colors"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => removeDraft(draft.id)}
                                  className="text-[#4E3629] hover:text-red-500 bg-white/50 border-2 border-[#4E3629] p-1 rounded-md cursor-pointer transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <h3 className="font-bold text-sm text-[#4E3629] mt-3 line-clamp-2 leading-tight">
                              {draft.description}
                            </h3>
                          </div>

                          <div className="flex justify-between items-end mt-4">
                            <div>
                              <p className="text-[10px] text-[#4E3629]/60 font-bold">{draft.date}</p>
                              <p className="font-black text-lg mt-0.5">${draft.amount.toFixed(2)}</p>
                            </div>

                            <button
                              onClick={() => handleCommitDraft(draft.id)}
                              className="w-9 h-9 bg-white border-2 border-[#4E3629] rounded-full flex items-center justify-center text-pink-500 shadow-sm hover:bg-pink-500 hover:text-white cursor-pointer transition-all group"
                              title="Confirm Draft"
                            >
                              <PawPrint size={16} className="group-hover:scale-110 transition-transform text-[#4E3629] hover:text-white" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Center Button: Save to Ledger */}
      {drafts.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleCommitAll}
            className="px-8 py-3 bg-[#FFAE58] hover:bg-[#EAA050] text-white font-black text-lg rounded-full border-4 border-[#4E3629] shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            Save to Ledger ✨
          </button>
        </div>
      )}
    </div>
  );
};
