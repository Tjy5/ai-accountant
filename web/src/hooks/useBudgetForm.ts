import { useState, useCallback } from 'react';
import { Form, message } from 'antd';
import type { Budget, BudgetFormData } from '../types/budget';
import { validateBudgetForm } from '../utils/budgetUtils';
import dayjs from 'dayjs';

export interface UseBudgetFormOptions {
  onSuccess?: () => void; // 修改为无参数，因为它只触发刷新
  onError?: (error: string) => void;
}

export interface UseBudgetFormReturn {
  form: any;
  loading: boolean;
  modalVisible: boolean;
  editingBudget: Budget | null;
  
  openCreateModal: (budgetMode: 'total' | 'category') => void;
  openEditModal: (budget: Budget) => void;
  closeModal: () => void;
  
  handleSubmit: (values: BudgetFormData) => Promise<void>;
  
  validateForm: (values: any) => string[];
}

export const useBudgetForm = (
  onSave: (budgetData: Partial<Budget>) => Promise<void>,
  onUpdate: (id: number, budgetData: Partial<Budget>) => Promise<void>,
  options: UseBudgetFormOptions = {}
): UseBudgetFormReturn => {
  const { onSuccess, onError } = options;
  
  const [form] = Form.useForm<BudgetFormData>();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const openCreateModal = useCallback((budgetMode: 'total' | 'category') => {
    setEditingBudget(null);
    setModalVisible(true);
    // 移到 modal 打开后再设置表单值，确保 form 已连接
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        budgetMode: 'recurring',
        // 根据外部传入的 budgetMode 设置 budgetType
        budgetType: budgetMode === 'total' ? 'total' : 'category',
        period: 'monthly',
        alertThreshold: 80,
        isActive: true,
      });
    }, 0);
  }, [form]);

  const openEditModal = useCallback((budget: Budget) => {
    setEditingBudget(budget);
    setModalVisible(true);

    setTimeout(() => {
      // 逻辑重构：根据 budget 数据推断模式并填充表单
      const isRecurring = budget.period && ['monthly', 'quarterly', 'yearly'].includes(budget.period);
      const budgetMode: 'recurring' | 'one-time' = isRecurring ? 'recurring' : 'one-time';

      let budgetAmount = budget.monthlyLimit; // 默认用月度
      if (isRecurring) {
        if (budget.period === 'quarterly') budgetAmount = budget.quarterlyLimit;
        if (budget.period === 'yearly') budgetAmount = budget.yearlyLimit;
      } else {
        // 对于一次性预算，金额可能是任意一个，后端应确保它们一致
        budgetAmount = budget.monthlyLimit || budget.quarterlyLimit || budget.yearlyLimit;
      }

      const baseValues = {
        budgetMode,
        budgetType: budget.budgetType || 'category',
        categoryId: budget.categoryId,
        budgetAmount,
        alertThreshold: budget.alertThreshold,
        isActive: budget.isActive,
        description: budget.description,
      };

      if (isRecurring) {
        form.setFieldsValue({
          ...baseValues,
          period: budget.period as 'monthly' | 'quarterly' | 'yearly', // Type assertion
          effectiveCycle: budget.startDate ? dayjs(budget.startDate) : undefined,
        });
      } else {
        // 对于一次性预算，将 description 拆分给 budgetName
        form.setFieldsValue({
          ...baseValues,
          period: undefined, // 确保 period 字段为空
          budgetName: budget.description, // 将旧的描述作为新的名称
          startDate: budget.startDate ? dayjs(budget.startDate) : undefined,
          endDate: budget.endDate ? dayjs(budget.endDate) : undefined,
        });
      }
    }, 0);
  }, [form]);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingBudget(null);
    form.resetFields();
  }, [form]);

  const handleSubmit = useCallback(async (values: BudgetFormData) => {
    // 验证逻辑可以后续根据新表单细化
    // const validationErrors = validateBudgetForm(values);
    // if (validationErrors.length > 0) { ... }

    try {
      setLoading(true);

      const {
        budgetMode,
        budgetType,
        categoryId,
        budgetAmount,
        period,
        effectiveCycle,
        budgetName,
        startDate: oneTimeStartDate,
        endDate: oneTimeEndDate,
        alertThreshold,
        isActive,
        description,
      } = values;

      const budgetData: Partial<Budget> = {
        budgetType,
        categoryId: budgetType === 'category' ? categoryId : undefined,
        alertThreshold,
        isActive,
      };

      if (budgetMode === 'recurring') {
        // 处理重复预算
        budgetData.period = period;
        
        // 金额转换
        if (period === 'monthly') {
          budgetData.monthlyLimit = budgetAmount;
          budgetData.quarterlyLimit = budgetAmount * 3;
          budgetData.yearlyLimit = budgetAmount * 12;
        } else if (period === 'quarterly') {
          budgetData.monthlyLimit = budgetAmount / 3;
          budgetData.quarterlyLimit = budgetAmount;
          budgetData.yearlyLimit = budgetAmount * 4;
        } else if (period === 'yearly') {
          budgetData.monthlyLimit = budgetAmount / 12;
          budgetData.quarterlyLimit = budgetAmount / 4;
          budgetData.yearlyLimit = budgetAmount;
        }

        // 日期计算
        const targetDate = effectiveCycle ? dayjs(effectiveCycle) : dayjs();
        const unit = period === 'monthly' ? 'month' : period === 'quarterly' ? 'quarter' : 'year';
        budgetData.startDate = targetDate.startOf(unit as any).format('YYYY-MM-DD');
        budgetData.endDate = targetDate.endOf(unit as any).format('YYYY-MM-DD');
        budgetData.description = description;

      } else {
        // 处理一次性预算
        budgetData.period = 'custom'; // 或 null，取决于后端如何识别
        
        // 金额直接赋值，不进行转换
        budgetData.monthlyLimit = budgetAmount;
        budgetData.quarterlyLimit = budgetAmount;
        budgetData.yearlyLimit = budgetAmount;

        // 使用用户指定的日期
        budgetData.startDate = dayjs(oneTimeStartDate).format('YYYY-MM-DD');
        budgetData.endDate = dayjs(oneTimeEndDate).format('YYYY-MM-DD');

        // 合并预算名称和描述
        let finalDescription = description || '';
        if (budgetName) {
          finalDescription = `[${budgetName}]` + (description ? ` ${description}` : '');
        }
        budgetData.description = finalDescription;
      }

      if (editingBudget) {
        await onUpdate(editingBudget.id, budgetData);
      } else {
        await onSave(budgetData);
      }

      onSuccess?.();
      closeModal();

    } catch (err: any) {
      const errorMsg = err?.message || '操作失败';
      message.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [editingBudget, onSave, onUpdate, onSuccess, onError, closeModal, form]);


  const validateForm = useCallback((values: any) => {
    return validateBudgetForm(values);
  }, []);

  return {
    form,
    loading,
    modalVisible,
    editingBudget,
    
    openCreateModal,
    openEditModal,
    closeModal,
    
    handleSubmit,
    
    validateForm
  };
};
