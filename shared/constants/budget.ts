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
