import api from './axiosInstance';
import type { DraftTransaction } from '../store/useDraftStore';
import type { AiDraftResponse, AnalyzeImageOptions } from '../types/ai';

const responseFrom = (data: AiDraftResponse): AiDraftResponse => ({
  ...data,
  drafts: Array.isArray(data?.drafts) ? data.drafts : [],
  warnings: Array.isArray(data?.warnings) ? data.warnings : [],
  ignored: Array.isArray(data?.ignored) ? data.ignored : [],
});

export const analyzeTextDrafts = async (text: string) => {
  const { data } = await api.post<AiDraftResponse>('/ai/analyze', { text });
  return responseFrom(data);
};

export const analyzeImageDrafts = async (image: string, options: AnalyzeImageOptions = {}) => {
  const { data } = await api.post<AiDraftResponse>('/ai/analyze-image', { image, ...options });
  return responseFrom(data);
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
