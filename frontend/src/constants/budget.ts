import type { QuickBudgetTemplate } from '../types/budget';

export const BUDGET_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly', 
  YEARLY: 'yearly'
} as const;

export const ALERT_LEVELS = {
  SAFE: 'safe',
  WARNING: 'warning',
  DANGER: 'danger',
  OVER: 'over'
} as const;

export const BUDGET_ACTIONS = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  ADJUSTED: 'adjusted'
} as const;

export const DEFAULT_ALERT_THRESHOLDS = {
  WARNING: 70,
  DANGER: 90,
  OVER: 100
} as const;

export const ALERT_COLORS = {
  [ALERT_LEVELS.SAFE]: '#52c41a',
  [ALERT_LEVELS.WARNING]: '#faad14',
  [ALERT_LEVELS.DANGER]: '#fa541c',
  [ALERT_LEVELS.OVER]: '#f5222d'
} as const;

export const PERIOD_LABELS = {
  [BUDGET_PERIODS.MONTHLY]: '月度预算',
  [BUDGET_PERIODS.QUARTERLY]: '季度预算',
  [BUDGET_PERIODS.YEARLY]: '年度预算'
} as const;

export const ALERT_LEVEL_LABELS = {
  [ALERT_LEVELS.SAFE]: '安全',
  [ALERT_LEVELS.WARNING]: '警告',
  [ALERT_LEVELS.DANGER]: '危险',
  [ALERT_LEVELS.OVER]: '超支'
} as const;

export const BUDGET_ACTION_LABELS = {
  [BUDGET_ACTIONS.CREATED]: '创建',
  [BUDGET_ACTIONS.UPDATED]: '更新', 
  [BUDGET_ACTIONS.DELETED]: '删除',
  [BUDGET_ACTIONS.ADJUSTED]: '调整'
} as const;

export const BUDGET_ACTION_COLORS = {
  [BUDGET_ACTIONS.CREATED]: 'green',
  [BUDGET_ACTIONS.UPDATED]: 'blue',
  [BUDGET_ACTIONS.DELETED]: 'red',
  [BUDGET_ACTIONS.ADJUSTED]: 'orange'
} as const;