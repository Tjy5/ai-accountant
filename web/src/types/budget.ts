
import type { Dayjs } from 'dayjs';

export interface Budget {
  id: number;
  category?: string; // 可选，总预算时为空
  categoryId?: string; // 可选，总预算时为空
  budgetType: 'category' | 'total'; // 预算类型：分类预算 或 总预算
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
  parentId?: number; // 新增：父预算ID，适用于分类预算
  children?: Budget[]; // 新增：子预算列表，适用于总预算
}

export interface BudgetStatus {
  budgetType: 'category' | 'total'; // 预算类型：分类预算 或 总预算
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
  budgetMode: 'recurring' | 'one-time'; // 新增：预算模式
  budgetType: 'category' | 'total';
  categoryId?: string;
  
  budgetAmount: number;
  
  // 重复预算字段
  period?: 'monthly' | 'quarterly' | 'yearly';
  effectiveCycle?: Dayjs; // 新增：生效周期

  // 一次性预算字段
  budgetName?: string; // 新增：预算名称
  startDate?: Dayjs | null; // 类型修改为 Dayjs
  endDate?: Dayjs | null;   // 类型修改为 Dayjs

  // 通用字段
  alertThreshold: number;
  isActive: boolean;
  description?: string;
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


export interface BudgetAPIResponse {
  budgets: Budget[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BudgetStatusAPIResponse {
  month: string;
  budgets: BudgetStatus[];
  summary: BudgetOverview;
}

export interface BudgetHistoryAPIResponse {
  history: BudgetHistory[];
  total: number;
  page: number;
  pageSize: number;
}

// 新的父子预算状态接口
export interface TotalBudgetStatus {
  id: number;
  limit: number;
  spent: number;
  remaining: number;
  allocated: number;
  unallocated: number;
}

export interface CategoryBudgetStatus {
  id: number;
  category: string;
  categoryId: string;
  limit: number;
  spent: number;
  remaining: number;
  parentId: number;
}

export interface BudgetStatusResponse {
  totalBudget: TotalBudgetStatus | null;
  categoryBudgets: CategoryBudgetStatus[];
}