import type { DraftInput } from '../store/useDraftStore';

export type AiDraftResponse = {
  reply?: string;
  replyType?: string;
  messages?: Array<{ type: string; content: string }>;
  intent?: 'bookkeeping' | 'clarification' | 'none' | string;
  drafts?: DraftInput[];
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
  warnings?: string[];
  ignored?: unknown[];
  rawText?: string | null;
  timestamp?: number;
};

export type AnalyzeImageOptions = {
  filename?: string;
  text?: string;
};

export type AiSettings = {
  aiAssistEnabled: boolean;
  apiKeyConfigured: boolean;
  apiKeyPreview?: string | null;
  usesUserApiKey: boolean;
  usesSystemFallback: boolean;
  baseUrl?: string | null;
  model?: string | null;
  effectiveBaseUrl: string;
  effectiveModel: string;
  encryptionConfigured: boolean;
  timestamp?: number;
};

export type AiSettingsUpdate = {
  aiAssistEnabled?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
  baseUrl?: string | null;
  model?: string | null;
};

export type AiConnectionTest = {
  ok: boolean;
  message: string;
  model: string;
  baseUrl: string;
  latencyMs: number;
  timestamp?: number;
};
