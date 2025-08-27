import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import api from '../utils/api';
import type {
  Budget,
  BudgetStatus,
  BudgetHistory,
  BudgetOverview,
  BudgetAPIResponse,
  BudgetStatusAPIResponse,
  BudgetHistoryAPIResponse,
  BudgetStatusResponse
} from '../types/budget';
import { 
  calculateBudgetOverview, 
  generateMockBudgetStatus,
  getBudgetHealthScore 
} from '../utils/budgetUtils';

export interface UseBudgetOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableMockData?: boolean;
  budgetMode?: 'total' | 'category';
}

export interface UseBudgetReturn {
  budgets: Budget[];
  budgetStatus: BudgetStatus[];
  budgetHistory: BudgetHistory[];
  budgetOverview: BudgetOverview;
  healthScore: number;
  loading: boolean;
  error: string | null;

  // 新的父子预算数据
  totalBudget: Budget | null;
  categoryBudgets: Budget[];
  budgetStatusData: BudgetStatusResponse | null;

  fetchBudgets: () => Promise<void>;
  fetchBudgetStatus: (forceRefresh?: boolean) => Promise<void>;
  fetchBudgetHistory: () => Promise<void>;

  createBudget: (budgetData: Partial<Budget>) => Promise<void>;
  updateBudget: (id: number, budgetData: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: number) => Promise<void>;

  refresh: (force?: boolean) => Promise<void>;
}

export const useBudget = (options: UseBudgetOptions = {}): UseBudgetReturn => {
  const { enableMockData = true, budgetMode = 'category' } = options;
  
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新的父子预算状态
  const [totalBudget, setTotalBudget] = useState<Budget | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<Budget[]>([]);
  const [budgetStatusData, setBudgetStatusData] = useState<BudgetStatusResponse | null>(null);

  const budgetOverview = useMemo(() => 
    calculateBudgetOverview(budgetStatus, budgets, budgetMode),
    [budgetStatus, budgets, budgetMode]
  );

  const healthScore = useMemo(() =>
    getBudgetHealthScore(budgetStatus), 
    [budgetStatus]
  );

  const fetchBudgets = useCallback(async () => {
    try {
      const data = await api.get<Budget[]>('/api/budgets');
      const budgetList = Array.isArray(data) ? data : [];

      // 处理新的层次结构
      if (budgetList.length > 0 && budgetList[0].budgetType === 'total') {
        const totalBudgetData = budgetList[0];
        setTotalBudget(totalBudgetData);
        setCategoryBudgets(totalBudgetData.children || []);
        setBudgets([totalBudgetData, ...(totalBudgetData.children || [])]);
      } else {
        setTotalBudget(null);
        setCategoryBudgets([]);
        setBudgets([]);
      }

      setError(null);
    } catch (err: any) {
      console.error('获取预算列表失败:', err);

      if (enableMockData) {
        // 模拟新的父子结构数据
        const mockTotalBudget: Budget = {
          id: 1,
          budgetType: 'total' as const,
          monthlyLimit: 8000,
          quarterlyLimit: 24000,
          yearlyLimit: 96000,
          period: 'monthly',
          startDate: dayjs().format('YYYY-MM-DD'),
          endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
          alertThreshold: 80,
          isActive: true,
          description: '总预算',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          children: [
            {
              id: 2,
              category: '餐饮',
              categoryId: '6',
              budgetType: 'category' as const,
              monthlyLimit: 3000,
              quarterlyLimit: 9000,
              yearlyLimit: 36000,
              period: 'monthly',
              startDate: dayjs().format('YYYY-MM-DD'),
              endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
              alertThreshold: 80,
              isActive: true,
              description: '日常餐饮消费预算',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              parentId: 1
            },
            {
              id: 3,
              category: '交通',
              categoryId: '7',
              budgetType: 'category' as const,
              monthlyLimit: 1000,
              quarterlyLimit: 3000,
              yearlyLimit: 12000,
              period: 'monthly',
              startDate: dayjs().format('YYYY-MM-DD'),
              endDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
              alertThreshold: 85,
              isActive: true,
              description: '交通出行费用预算',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              parentId: 1
            }
          ]
        };

        setTotalBudget(mockTotalBudget);
        setCategoryBudgets(mockTotalBudget.children || []);
        setBudgets([mockTotalBudget, ...(mockTotalBudget.children || [])]);
      }

      setError(err?.message || '获取预算列表失败');
    }
  }, [enableMockData]);

  const fetchBudgetStatus = useCallback(async (forceRefresh = false) => {
    try {
      // 增加强制刷新参数
      const timestamp = forceRefresh ? `?t=${new Date().getTime()}` : '';
      const data = await api.get<BudgetStatusResponse>(`/api/budget-status${timestamp}`);
      console.log('加载预算状态成功:', data);

      setBudgetStatusData(data);
      setError(null);
    } catch (err: any) {
      console.error('获取预算状态失败:', err);

      if (enableMockData && totalBudget) {
        // 生成模拟的状态数据
        const mockStatusData: BudgetStatusResponse = {
          totalBudget: {
            id: totalBudget.id,
            limit: totalBudget.monthlyLimit,
            spent: Math.floor(Math.random() * totalBudget.monthlyLimit * 0.8),
            remaining: 0, // 计算得出
            allocated: categoryBudgets.reduce((sum, cb) => sum + cb.monthlyLimit, 0),
            unallocated: 0 // 计算得出
          },
          categoryBudgets: categoryBudgets.map(cb => ({
            id: cb.id,
            category: cb.category || '',
            categoryId: cb.categoryId || '',
            limit: cb.monthlyLimit,
            spent: Math.floor(Math.random() * cb.monthlyLimit * 0.6),
            remaining: 0, // 计算得出
            parentId: totalBudget.id
          }))
        };

        // 计算剩余金额
        if (mockStatusData.totalBudget) {
          mockStatusData.totalBudget.remaining = mockStatusData.totalBudget.limit - mockStatusData.totalBudget.spent;
          mockStatusData.totalBudget.unallocated = mockStatusData.totalBudget.limit - mockStatusData.totalBudget.allocated;
        }

        mockStatusData.categoryBudgets.forEach(cb => {
          cb.remaining = cb.limit - cb.spent;
        });

        setBudgetStatusData(mockStatusData);
      }

      setError(err?.message || '获取预算状态失败');
    }
  }, [enableMockData, totalBudget, categoryBudgets]);

  const fetchBudgetHistory = useCallback(async () => {
    try {
      const data = await api.get<BudgetHistoryAPIResponse>('/api/budget-history');
      setBudgetHistory(data?.history || []);
      setError(null);
    } catch (err: any) {
      console.error('获取预算历史失败:', err);
      setBudgetHistory([]);
      setError(err?.message || '获取预算历史失败');
    }
  }, []);

  const createBudget = useCallback(async (budgetData: Partial<Budget>) => {
    try {
      setLoading(true);
      await api.post('/api/budgets', budgetData);
      message.success('预算创建成功');
      // 操作成功后，调用 refresh 函数强制刷新所有数据
      await refresh(true);
      setError(null);
    } catch (err: any) {
      const errorMsg = err?.message || '创建预算失败';
      setError(errorMsg);
      message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets, fetchBudgetStatus, fetchBudgetHistory]);

  const updateBudget = useCallback(async (id: number, budgetData: Partial<Budget>) => {
    try {
      setLoading(true);
      await api.put(`/api/budgets/${id}`, budgetData);
      message.success('预算更新成功');
      // 操作成功后，调用 refresh 函数强制刷新所有数据
      await refresh(true);
      setError(null);
    } catch (err: any) {
      const errorMsg = err?.message || '更新预算失败';
      setError(errorMsg);
      message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets, fetchBudgetStatus, fetchBudgetHistory]);

  const deleteBudget = useCallback(async (id: number) => {
    try {
      setLoading(true);
      await api.delete(`/api/budgets/${id}`);
      message.success('预算删除成功');
      // 操作成功后，调用 refresh 函数强制刷新所有数据
      await refresh(true);
      setError(null);
    } catch (err: any) {
      const errorMsg = err?.message || '删除预算失败';
      setError(errorMsg);
      message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets, fetchBudgetStatus, fetchBudgetHistory]);

  // 改造 refresh 函数，使其可以接受强制刷新参数，并成为唯一的数据刷新入口
  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      // 首先获取基础预算和历史记录
      await Promise.all([
        fetchBudgets(),
        fetchBudgetHistory(),
      ]);
      // 然后获取最新的预算状态，根据 force 参数决定是否绕过缓存
      await fetchBudgetStatus(force);
    } catch (err: any) {
      setError(err?.message || '刷新数据失败');
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets, fetchBudgetHistory, fetchBudgetStatus]); // 添加依赖

  // 只在组件初始化时加载数据，避免循环请求
  // 改造初始化逻辑，使用统一的 refresh 函数
  useEffect(() => {
    // 组件挂载时，强制刷新一次以获取最新数据
    refresh(true);
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 禁用自动刷新定时器，防止过多请求
  /*
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchBudgetStatus();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchBudgetStatus]);
  */

  return {
    budgets,
    budgetStatus,
    budgetHistory,
    budgetOverview,
    healthScore,
    loading,
    error,

    // 新的父子预算数据
    totalBudget,
    categoryBudgets,
    budgetStatusData,

    fetchBudgets,
    fetchBudgetStatus,
    fetchBudgetHistory,

    createBudget,
    updateBudget,
    deleteBudget,

    refresh
  };
};