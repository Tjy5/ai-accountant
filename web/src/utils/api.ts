import API_BASE_URL from '../config';
import type { AIAnalysisResult, AISettings, AISettingsResponse, ChatRequest, ChatResponse } from '../../../shared/types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiError extends Error {
  status?: number;
  details?: any;
}

const getStoredAuthToken = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw =
      window.localStorage.getItem('token') ||
      window.localStorage.getItem('authToken') ||
      window.localStorage.getItem('jwt');
    const t = raw ? String(raw).trim() : '';
    return t ? t : null;
  } catch {
    return null;
  }
};

const buildUrl = (path: string, params?: Record<string, string | number | boolean | Array<string | number>>): string => {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, String(v)));
      } else if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
};

const request = async <T>(method: HttpMethod, path: string, options?: {
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
}): Promise<T> => {
  const url = buildUrl(path, options?.params);
  const init: RequestInit = { method };
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = { ...(options?.headers || {}) };
  const token = getStoredAuthToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (Object.keys(headers).length > 0) {
    init.headers = headers;
  }
  if (options?.body !== undefined) {
    init.body = isFormData ? options.body : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e: any) {
    const err: ApiError = new Error(e?.message ? String(e.message) : 'Network request failed');
    err.status = 0;
    err.details = { cause: e };
    throw err;
  }
  if (!res.ok) {
    let details: any = undefined;
    try { details = await res.json(); } catch {}
    const err: ApiError = new Error(details?.error || res.statusText);
    err.status = res.status;
    err.details = details;
    throw err;
  }
  try {
    return await res.json();
  } catch {
    return undefined as unknown as T;
  }
};

export const api = {
  get: <T>(path: string, params?: Record<string, any>) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: any) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: any) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, formData: FormData) => request<T>('POST', path, { body: formData }),
  // AI API methods
  analyzeText: (text: string) => request<AIAnalysisResult>('POST', '/api/ai/analyze', { body: { text } }),
  getAISettings: () => request<AISettingsResponse>('GET', '/api/ai/settings'),
  updateAISettings: (settings: Partial<AISettings>) => request<AISettingsResponse>('PUT', '/api/ai/settings', { body: settings }),
  deleteAISettings: () => request<void>('DELETE', '/api/ai/settings'),
  bulkCreateTransactions: (transactions: AIAnalysisResult['transactions']) => request<{ transactions: any[] }>('POST', '/api/transactions/bulk', { body: { transactions } }),
  // AI Chat API methods
  chat: (chatRequest: ChatRequest) => request<ChatResponse>('POST', '/api/ai/chat', { body: chatRequest }),
  clearChatContext: () => request<void>('POST', '/api/ai/chat', { body: { messages: [], clearContext: true } }),
};

export default api;


