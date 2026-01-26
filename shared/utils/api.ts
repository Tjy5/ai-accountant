type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiError extends Error {
  status?: number;
  details?: any;
}

let BASE_URL = '';
let DEFAULT_HEADERS: Record<string, string> = {};

const getStoredAuthToken = (): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('jwt');
    const t = raw ? String(raw).trim() : '';
    return t ? t : null;
  } catch {
    return null;
  }
};

export const setBaseUrl = (url: string) => {
  BASE_URL = url;
};

export const setAuthToken = (token?: string | null) => {
  const t = token ? String(token).trim() : '';
  if (t.length > 0) {
    DEFAULT_HEADERS = { ...DEFAULT_HEADERS, Authorization: `Bearer ${t}` };
    return;
  }
  const { Authorization, ...rest } = DEFAULT_HEADERS;
  DEFAULT_HEADERS = rest;
};

const buildUrl = (path: string, params?: Record<string, string | number | boolean | Array<string | number>>): string => {
  const url = new URL(path, BASE_URL || 'http://localhost:3000');
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
  const headers: Record<string, string> = { ...DEFAULT_HEADERS, ...(options?.headers || {}) };
  if (!headers.Authorization) {
    const stored = getStoredAuthToken();
    if (stored) headers.Authorization = `Bearer ${stored}`;
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
  let res: any;
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
  try { return await res.json(); } catch { return undefined as unknown as T; }
};

export const api = {
  setBaseUrl,
  setAuthToken,
  get: <T>(path: string, params?: Record<string, any>) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: any) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: any) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, formData: FormData) => request<T>('POST', path, { body: formData })
};

export default api;

export function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; details?: { error?: string }; message?: string };
    if (e.details?.error) return e.details.error;
    if (e.message) return e.message;
    if (e.status) return `HTTP ${e.status}`;
  }
  if (typeof err === 'string') return err;
  return '未知错误';
}
