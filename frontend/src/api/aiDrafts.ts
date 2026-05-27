import api from './axiosInstance';
import type { DraftInput, DraftTransaction } from '../store/useDraftStore';

type DraftResponse = {
  drafts?: DraftInput[];
};

const draftsFrom = (data: DraftResponse) => Array.isArray(data?.drafts) ? data.drafts : [];

export const analyzeTextDrafts = async (text: string) => {
  const { data } = await api.post<DraftResponse>('/ai/analyze', { text });
  return draftsFrom(data);
};

export const analyzeImageDrafts = async (image: string, text: string) => {
  const { data } = await api.post<DraftResponse>('/ai/analyze-image', { image, text });
  return draftsFrom(data);
};

export const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const commitDrafts = async (drafts: DraftTransaction[]) => {
  if (drafts.length === 0) return;
  await api.post('/ai/transactions/commit', {
    drafts: drafts.map((draft) => ({ ...draft, confirmed: true })),
  });
};
