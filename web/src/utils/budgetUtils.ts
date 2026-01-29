import dayjs, { type Dayjs } from 'dayjs';
import type { Budget, BudgetStatus, BudgetOverview } from '../types/budget';
import { ALERT_LEVELS, DEFAULT_ALERT_THRESHOLDS, BUDGET_PERIODS } from '../constants/budget';

export const calculateBudgetStatus = (
  budget: Budget,
  spentAmount: number,
  currentDate: Dayjs = dayjs()
): BudgetStatus => {
  // 根据预算周期选择对应的预算限额
  let limit: number;
  if (budget.period === 'monthly') {
    limit = budget.monthlyLimit;
  } else if (budget.period === 'quarterly') {
    limit = budget.quarterlyLimit;
  } else if (budget.period === 'yearly') {
    limit = budget.yearlyLimit;
  } else {
    limit = budget.monthlyLimit; // 默认使用月度预算
  }
  
  let daysRemaining: number;
  
  switch (budget.period) {
    case BUDGET_PERIODS.MONTHLY:
      daysRemaining = currentDate.endOf('month').diff(currentDate, 'day');
      break;
    case BUDGET_PERIODS.QUARTERLY:
      daysRemaining = currentDate.endOf('quarter' as any).diff(currentDate, 'day');
      break;
    case BUDGET_PERIODS.YEARLY:
      daysRemaining = currentDate.endOf('year').diff(currentDate, 'day');
      break;
    default:
      daysRemaining = currentDate.endOf('month').diff(currentDate, 'day');
  }

  const remaining = Math.max(0, limit - spentAmount);
  const percentage = limit > 0 ? Math.round((spentAmount / limit) * 100) : 0;
  const isOverBudget = spentAmount > limit;

  let alertLevel: BudgetStatus['alertLevel'];
  if (percentage >= (budget.alertThreshold || DEFAULT_ALERT_THRESHOLDS.OVER)) {
    alertLevel = ALERT_LEVELS.OVER;
  } else if (percentage >= (budget.alertThreshold || DEFAULT_ALERT_THRESHOLDS.DANGER)) {
    alertLevel = ALERT_LEVELS.DANGER;
  } else if (percentage >= DEFAULT_ALERT_THRESHOLDS.WARNING) {
    alertLevel = ALERT_LEVELS.WARNING;
  } else {
    alertLevel = ALERT_LEVELS.SAFE;
  }

  return {
    budgetType: budget.budgetType, // 新增 budgetType
    category: budget.category || '总预算',
    categoryId: budget.categoryId || 'total',
    categoryColor: '',
    period: budget.period,
    limit,
    spent: spentAmount,
    remaining,
    percentage,
    isOverBudget,
    alertLevel,
    daysRemaining: Math.max(0, daysRemaining)
  };
};

export const calculateBudgetOverview = (
  budgetStatuses: BudgetStatus[],
  budgets: Budget[],
  budgetMode: 'total' | 'category' = 'category'
): BudgetOverview => {
  if (!budgetStatuses || budgetStatuses.length === 0) {
    return {
      totalBudget: 0,
      totalSpent: 0,
      totalRemaining: 0,
      overallPercentage: 0,
      activeBudgets: budgets?.filter(b => b.isActive).length || 0,
      overBudgetCount: 0,
      safeCount: 0,
      warningCount: 0,
      dangerCount: 0
    };
  }

  let totalBudget = 0;
  const totalSpent = budgetStatuses.reduce((sum, item) => sum + (item.spent || 0), 0);

  if (budgetMode === 'total') {
    // 总预算模式下，总预算是唯一的 total 类型的预算
    const totalBudgetStatus = budgetStatuses.find(b => b.budgetType === 'total');
    totalBudget = totalBudgetStatus?.limit || 0;
  } else {
    // 分类预算模式下，总预算是所有分类预算之和
    totalBudget = budgetStatuses
      .filter(b => b.budgetType === 'category')
      .reduce((sum, item) => sum + (item.limit || 0), 0);
  }
  const totalRemaining = Math.max(0, totalBudget - totalSpent);
  const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const activeBudgets = budgets?.filter(b => b.isActive).length || 0;
  const overBudgetCount = budgetStatuses.filter(b => b.isOverBudget).length;
  const safeCount = budgetStatuses.filter(b => b.alertLevel === ALERT_LEVELS.SAFE).length;
  const warningCount = budgetStatuses.filter(b => b.alertLevel === ALERT_LEVELS.WARNING).length;
  const dangerCount = budgetStatuses.filter(b => 
    b.alertLevel === ALERT_LEVELS.DANGER || b.alertLevel === ALERT_LEVELS.OVER
  ).length;

  return {
    totalBudget,
    totalSpent,
    totalRemaining,
    overallPercentage,
    activeBudgets,
    overBudgetCount,
    safeCount,
    warningCount,
    dangerCount
  };
};

export const validateBudgetForm = (values: any): string[] => {
  const errors: string[] = [];

  if (!values.budgetType) {
    errors.push('请选择预算类型');
  }

  // 如果是分类预算，必须选择分类
  if (values.budgetType === 'category' && !values.categoryId) {
    errors.push('请选择分类');
  }

  if (!values.budgetAmount || values.budgetAmount <= 0) {
    errors.push('预算金额必须大于0');
  }

  if (!values.period) {
    errors.push('请选择预算周期');
  }

  if (values.alertThreshold && (values.alertThreshold < 50 || values.alertThreshold > 100)) {
    errors.push('预警阈值应该在50%-100%之间');
  }

  return errors;
};

export const formatCurrency = (amount: number, currency: string = '¥'): string => {
  if (isNaN(amount)) return `${currency}0.00`;
  return `${currency}${amount.toFixed(2)}`;
};

export const formatPercentage = (percentage: number): string => {
  if (isNaN(percentage)) return '0%';
  return `${Math.round(percentage)}%`;
};

export const getBudgetPeriodDates = (period: string, baseDate: Dayjs = dayjs()) => {
  switch (period) {
    case BUDGET_PERIODS.MONTHLY:
      return {
        start: baseDate.startOf('month'),
        end: baseDate.endOf('month')
      };
    case BUDGET_PERIODS.QUARTERLY:
      return {
        start: baseDate.startOf('quarter' as any),
        end: baseDate.endOf('quarter' as any)
      };
    case BUDGET_PERIODS.YEARLY:
      return {
        start: baseDate.startOf('year'),
        end: baseDate.endOf('year')
      };
    default:
      return {
        start: baseDate.startOf('month'),
        end: baseDate.endOf('month')
      };
  }
};


export const generateMockBudgetStatus = (budgets: Budget[]): BudgetStatus[] => {
  return budgets.map(budget => {
    const mockSpent = Math.random() * budget.monthlyLimit * 1.2;
    return calculateBudgetStatus(budget, mockSpent);
  });
};

export const isDailyBudgetExceeded = (
  dailySpent: number,
  monthlyBudget: number,
  currentDate: Dayjs = dayjs()
): boolean => {
  const daysInMonth = currentDate.daysInMonth();
  const dailyBudget = monthlyBudget / daysInMonth;
  return dailySpent > dailyBudget;
};

export const getRecommendedDailySpending = (
  monthlyBudget: number,
  currentSpent: number,
  currentDate: Dayjs = dayjs()
): number => {
  const daysRemaining = currentDate.endOf('month').diff(currentDate, 'day') + 1;
  const remainingBudget = Math.max(0, monthlyBudget - currentSpent);
  
  if (daysRemaining <= 0) return 0;
  
  return remainingBudget / daysRemaining;
};

export const getBudgetHealthScore = (budgetStatuses: BudgetStatus[]): number => {
  if (!budgetStatuses || budgetStatuses.length === 0) return 100;
  
  let totalScore = 0;
  
  budgetStatuses.forEach(status => {
    let score = 100;
    
    if (status.alertLevel === ALERT_LEVELS.OVER) {
      score = 0;
    } else if (status.alertLevel === ALERT_LEVELS.DANGER) {
      score = 25;
    } else if (status.alertLevel === ALERT_LEVELS.WARNING) {
      score = 60;
    } else {
      score = 100;
    }
    
    totalScore += score;
  });
  
  return Math.round(totalScore / budgetStatuses.length);
};
