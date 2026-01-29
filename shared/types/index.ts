import type { Dayjs } from 'dayjs';

export type DateLike = string | Date | Dayjs;

// Transaction Types
export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  is_voice_input?: boolean;
  voice_input_text?: string;
  tags?: string[] | string;
}

export type TransactionFormData = {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  date?: DateLike;
  is_voice_input?: boolean;
  voice_input_text?: string;
  tags?: string[];
};

// Category Types
export interface Category {
  id: number | string;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  description?: string;
}

// Budget Types
export interface Budget {
  id: number;
  category?: string;
  categoryId?: string;
  budgetType: 'category' | 'total';
  monthlyLimit: number;
  quarterlyLimit: number;
  yearlyLimit: number;
  period: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: string;
  endDate: string;
  alertThreshold: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  parentId?: number;
  children?: Budget[];
}

export interface BudgetStatus {
  budgetType: 'category' | 'total';
  category: string;
  categoryId: string;
  categoryColor: string;
  period: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
  alertLevel: 'safe' | 'warning' | 'danger' | 'over';
  daysRemaining: number;
  monthlySpent?: number;
  quarterlySpent?: number;
  yearlySpent?: number;
}

export interface BudgetOverview {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overallPercentage: number;
  activeBudgets: number;
  overBudgetCount: number;
  safeCount: number;
  warningCount: number;
  dangerCount: number;
}

export interface BudgetHistory {
  id: number;
  budgetId: number;
  action: 'created' | 'updated' | 'deleted' | 'adjusted';
  oldValue?: number;
  newValue: number;
  reason?: string;
  createdAt: string;
}

export interface BudgetFormData {
  budgetMode: 'recurring' | 'one-time';
  budgetType: 'category' | 'total';
  categoryId?: string;
  budgetAmount: number;
  period?: 'monthly' | 'quarterly' | 'yearly';
  effectiveCycle?: DateLike;
  budgetName?: string;
  startDate?: DateLike;
  endDate?: DateLike;
  alertThreshold: number;
  isActive: boolean;
  description?: string;
}

// Export Types
export interface ExportTransaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  is_voice_input?: boolean;
  voice_input_text?: string;
  tags?: string[] | string;
}

export interface ExportOptions {
  format: 'csv' | 'excel';
  fields: string[];
  filename?: string;
}

// AI Types
export interface AITransactionDraft {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  confidence?: number;
  sourceSpan?: { start: number; end: number };
  _draftId?: string; // Client-side unique ID for edit/delete tracking
}

export interface AIAnalysisResult {
  transactions: AITransactionDraft[];
  ignored: string[];
  warnings: string[];
}

export interface AISettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

export interface AISettingsResponse {
  settings: AISettings;
}

// AI Chat Types
export type ChatIntent = 'bookkeeping' | 'update_draft' | 'clarification' | 'query' | 'chit_chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  drafts?: ChatTransactionDraft[];
  status?: 'sending' | 'sent' | 'error';
}

export interface ChatTransactionDraft extends AITransactionDraft {
  _draftId: string;
  saved?: boolean;
  superseded?: boolean;
  tags?: string[];
}

export interface ChatClientContext {
  timezone: string;
  locale: string;
  now: string;
}

export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  clientContext: ChatClientContext;
  pendingDrafts?: ChatTransactionDraft[];
  clearContext?: boolean;
}

export interface ChatResponse {
  reply: string;
  intent: ChatIntent;
  drafts: ChatTransactionDraft[];
  needsClarification: boolean;
  clarificationQuestion?: string;
  warnings: string[];
  ignored: string[];
}
