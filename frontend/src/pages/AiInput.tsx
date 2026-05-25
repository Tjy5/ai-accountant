import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useDraftStore } from '../store/useDraftStore';
import type { DraftTransaction } from '../store/useDraftStore';
import api from '../api/axiosInstance';
import { Send, UploadCloud, PawPrint, Trash2, Edit2, CheckCircle2, Save, X } from 'lucide-react';

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
      // Mock parsing for demonstration
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
      console.warn('Commit failed', err);
      alert('Failed to commit transaction. Please try again.');
    }
  };

  const handleCommitAll = async () => {
    if (drafts.length === 0) return;
    
    try {
      const payloadDrafts = drafts.map(d => ({ ...d, confirmed: true }));
      await api.post('/ai/transactions/commit', { drafts: payloadDrafts });
      clearDrafts();
    } catch (err) {
      console.warn('Commit all failed', err);
      alert('Failed to commit all transactions.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[calc(100vh-6rem)]">
      {/* Left side: Inputs */}
      <div className="flex-1 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">AI Bookkeeper 🤖</h1>
          <p className="text-gray-500 mt-2">Just tell me what you spent, or show me a receipt!</p>
        </div>

        {/* Text Input Card */}
        <Card className="flex flex-col gap-4 relative">
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-macaron-yellow rounded-full flex items-center justify-center shadow-sm z-10 animate-bounce">
            💬
          </div>
          <h2 className="text-lg font-bold text-gray-800">Tell me about it</h2>
          <textarea
            className="w-full h-32 p-4 bg-gray-50 border-2 border-gray-100 rounded-xl resize-none focus:outline-none focus:border-macaron-mint focus:ring-2 focus:ring-macaron-mint/20 transition-all"
            placeholder="e.g., I bought a sushi lunch for $45 yesterday."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={handleTextAnalyze} disabled={loading || !textInput.trim()}>
              {loading ? 'Thinking...' : 'Analyze'} <Send size={18} className="ml-2" />
            </Button>
          </div>
        </Card>

        {/* Receipt Upload Card */}
        <Card className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-macaron-pink bg-macaron-pink/5 hover:bg-macaron-pink/10 transition-colors cursor-pointer relative overflow-hidden group">
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            onChange={handleFileUpload}
          />
          <div className="flex flex-col items-center gap-3 text-pink-700">
            {uploading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-700"></div>
            ) : (
              <>
                <UploadCloud size={48} className="group-hover:-translate-y-2 transition-transform duration-300" />
                <span className="font-bold text-lg">Drop receipt here</span>
                <span className="text-sm opacity-70">or click to browse</span>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Right side: Sticky Notes (Drafts) */}
      <div className="flex-[1.2] bg-gray-50 rounded-cute p-6 shadow-inner relative border-4 border-gray-100/50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            📝 Draft Board
            <span className="bg-macaron-pink text-pink-800 text-xs py-1 px-3 rounded-full">
              {drafts.length}
            </span>
          </h2>
          {drafts.length > 0 && (
            <Button variant="ghost" onClick={handleCommitAll} className="text-emerald-600 hover:bg-emerald-50 text-sm">
              <CheckCircle2 size={16} className="mr-2" /> Confirm All
            </Button>
          )}
        </div>

        {drafts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4 mt-20">
            <div className="text-6xl opacity-50">📋</div>
            <p className="font-medium">No drafts yet. Try adding some!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {drafts.map((draft, index) => (
              <div 
                key={draft.id} 
                className="bg-macaron-yellow relative p-5 rounded-md shadow-cute transform transition-all"
                style={{
                  transform: editingId === draft.id ? 'none' : `rotate(${index % 2 === 0 ? '2deg' : '-2deg'})`,
                  zIndex: editingId === draft.id ? 10 : 1
                }}
              >
                {/* Folded corner effect */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-black/5 rounded-bl-xl"></div>
                
                {editingId === draft.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editForm.category || ''} 
                        onChange={e => setEditForm({...editForm, category: e.target.value})}
                        className="text-xs font-bold px-2 py-1 rounded-md border w-full bg-white/80 focus:bg-white"
                        placeholder="Category"
                      />
                      <select 
                        value={editForm.type || 'expense'}
                        onChange={e => setEditForm({...editForm, type: e.target.value as 'income'|'expense'})}
                        className="text-xs font-bold px-2 py-1 rounded-md border w-full bg-white/80 focus:bg-white"
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                    <textarea 
                      value={editForm.description || ''} 
                      onChange={e => setEditForm({...editForm, description: e.target.value})}
                      className="font-bold text-gray-800 text-sm w-full border rounded p-2 bg-white/80 focus:bg-white resize-none"
                      rows={2}
                      placeholder="Description"
                    />
                    <input 
                      type="date" 
                      value={editForm.date || ''} 
                      onChange={e => setEditForm({...editForm, date: e.target.value})}
                      className="text-xs text-gray-800 font-semibold border rounded p-1 w-full bg-white/80 focus:bg-white"
                    />
                    <div className="flex items-center gap-1 border rounded p-1 bg-white/80 focus-within:bg-white">
                      <span className="text-gray-500 font-bold pl-1">$</span>
                      <input 
                        type="number" 
                        value={editForm.amount || ''} 
                        onChange={e => setEditForm({...editForm, amount: parseFloat(e.target.value) || 0})}
                        className="font-black text-xl text-gray-900 w-full outline-none bg-transparent"
                        step="0.01"
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 bg-black/5 rounded-full p-1" title="Cancel">
                        <X size={18} />
                      </button>
                      <button onClick={() => {
                        updateDraft(draft.id, editForm);
                        setEditingId(null);
                      }} className="bg-emerald-500 text-white p-1 rounded-full hover:bg-emerald-600 transition-colors" title="Save">
                        <Save size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-2 pr-6">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${draft.type === 'income' ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                        {draft.category}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditingId(draft.id);
                          setEditForm(draft);
                        }} className="text-yellow-700 hover:text-blue-600 transition-colors bg-white/50 p-1 rounded-md">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => removeDraft(draft.id)} className="text-yellow-700 hover:text-red-500 transition-colors bg-white/50 p-1 rounded-md">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-800 mt-2 line-clamp-2">{draft.description}</h3>
                    
                    <div className="flex justify-between items-end mt-6">
                      <div>
                        <p className="text-xs text-yellow-800/60 font-semibold">{draft.date}</p>
                        <p className="font-black text-xl text-gray-900 mt-1">${draft.amount.toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => handleCommitDraft(draft.id)}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-macaron-pink shadow-sm hover:bg-macaron-pink hover:text-white transition-all group"
                        title="Confirm Draft"
                      >
                        <PawPrint size={20} className="group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
