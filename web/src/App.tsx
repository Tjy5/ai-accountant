import { useState, Suspense, lazy } from 'react';
import { Layout, Row, Col, Card, message, ConfigProvider, Spin, App as AntdApp } from 'antd';
import { useResponsive } from './hooks/useResponsive';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import TransactionForm from './TransactionForm.tsx';
import TransactionList from './TransactionList.tsx';
import EnhancedSearch, { type EnhancedFilterParams } from './components/EnhancedSearch.tsx';
import MobileTransactionList from './components/MobileTransactionList';
import ExportModal from './ExportModal.tsx';
import ImportModal from './ImportModal.tsx';
import EditTransactionModal from './EditTransactionModal.tsx';
import API_BASE_URL from './config.ts';
import api from '../../shared/utils/api';
import type { Transaction, TransactionFormData } from '../../shared/types';

// Dynamically import the Dashboard component
const Dashboard = lazy(() => import('./Dashboard.tsx'));

dayjs.locale('zh-cn');
api.setBaseUrl(API_BASE_URL);

const { Header, Content } = Layout;

const App = () => {
  const { modal } = AntdApp.useApp();
  // 1. React Query Client
  const queryClient = useQueryClient();
  
  // 2. Responsive info
  const { isMobile } = useResponsive();
  
  // 3. State Management (only for filters)
  const [filters, setFilters] = useState<EnhancedFilterParams>({});
  const [activeTab, setActiveTab] = useState<string>('1'); // 添加标签页状态管理
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState<boolean>(false); // 控制新建分类弹窗

  // 3. Data Fetching with useQuery
  const { data: transactions = [], isLoading: loading } = useQuery<Transaction[]>({
    queryKey: ['transactions', filters], // Query key includes filters
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.type && filters.type !== 'all') params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.category && filters.category.length > 0) params.category = filters.category;
      if (filters.amountRange && (filters.amountRange[0] > 0 || filters.amountRange[1] < 10000)) {
        params.minAmount = filters.amountRange[0];
        params.maxAmount = filters.amountRange[1];
      }
      if (filters.description) params.description = filters.description;
      if (filters.tags && filters.tags.length > 0) params.tag = filters.tags;

      const resp = await api.get<any>('/api/transactions', params);
      const data: Transaction[] = Array.isArray(resp) ? resp : (resp && Array.isArray(resp.transactions) ? resp.transactions : []);

      return data.map((item: Transaction) => ({
        ...item,
        amount: Number.isFinite(item.amount) ? item.amount : 0,
      }));
    },
  });

  // 4. Data Mutations with useMutation
  const mutationOptions = {
    onSuccess: () => {
      // When mutation is successful, invalidate the transactions query to refetch data
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      // 同步刷新预算状态
      queryClient.invalidateQueries({ queryKey: ['budget-status'] as any });
    },
    onError: (error: Error) => {
      message.error(`操作失败: ${error.message}`);
    },
  };

  const addTransactionMutation = useMutation({
    mutationFn: async (formData: TransactionFormData) => {
      const dateValue = (formData as any)?.date;
      const isoDate = dateValue ? (typeof dateValue?.toDate === 'function' ? dateValue.toDate().toISOString() : new Date(dateValue).toISOString()) : undefined;
      const sanitizedAmount = Number.isFinite(formData.amount) ? formData.amount : 0;
      const payload = { ...formData, amount: sanitizedAmount, ...(isoDate ? { date: isoDate } : {}) };
      
      return api.post('/api/transactions', payload);
    },
    ...mutationOptions,
    onSuccess: () => {
      message.success('添加成功');
      mutationOptions.onSuccess();
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('deleteTransactionMutation.mutationFn开始执行，ID:', id);
      console.log('准备发送DELETE请求到:', `${API_BASE_URL}/api/transactions/${id}`);
      
      await api.delete(`/api/transactions/${id}`);
    },
    onMutate: (id) => {
      console.log('deleteTransactionMutation.onMutate被调用，ID:', id);
    },
    onSuccess: (_, id) => {
      console.log('deleteTransactionMutation.onSuccess被调用，ID:', id);
      message.success('删除成功');
      mutationOptions.onSuccess();
    },
    onError: (error, id) => {
      console.error('deleteTransactionMutation.onError被调用，ID:', id, '错误:', error);
      mutationOptions.onError(error);
    }
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number, formData: TransactionFormData }) => {
      const dateValue = (formData as any)?.date;
      const isoDate = dateValue ? (typeof dateValue?.toDate === 'function' ? dateValue.toDate().toISOString() : new Date(dateValue).toISOString()) : undefined;
      const sanitizedAmount = Number.isFinite(formData.amount) ? formData.amount : 0;
      const payload = { ...formData, amount: sanitizedAmount, ...(isoDate ? { date: isoDate } : {}) };

      return api.put(`/api/transactions/${id}`, payload);
    },
    ...mutationOptions,
    onSuccess: () => {
      message.success('更新成功');
      mutationOptions.onSuccess();
    }
  });

  // Handler functions that call the mutations
  const handleFilterChange = (newFilters: EnhancedFilterParams) => {
    setFilters(newFilters);
  };

  const handleAddTransaction = (formData: TransactionFormData) => {
    addTransactionMutation.mutate(formData);
  };

  const handleDeleteTransaction = (id: number) => {
    console.log('App.tsx: handleDeleteTransaction被调用，ID:', id);
    console.log('准备调用deleteTransactionMutation.mutate');
    try {
      deleteTransactionMutation.mutate(id);
      console.log('deleteTransactionMutation.mutate调用完成');
    } catch (error) {
      console.error('deleteTransactionMutation.mutate调用出错:', error);
    }
  };

  const handleUpdateTransaction = (id: number, formData: TransactionFormData) => {
    updateTransactionMutation.mutate({ id, formData });
  };

  const handleCategoryChange = () => {
    // 当分类发生变化时，刷新相关数据
    // setCategoryRefreshKey(prev => prev + 1); // 暂时注释掉
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const handleNavigateToCategoryManager = () => {
    // 跳转到分类管理标签页并打开新建分类弹窗
    setActiveTab('2'); // 切换到分类管理标签页
    setShowCreateCategoryModal(true); // 显示新建分类弹窗
    message.success('已跳转到分类管理页面，新建分类弹窗已打开');
  };

  const handleCategoryModalClose = () => {
    setShowCreateCategoryModal(false); // 关闭新建分类弹窗
  };

  // 5. Mobile modals state
  const [mobileExportVisible, setMobileExportVisible] = useState(false);
  const [mobileImportVisible, setMobileImportVisible] = useState(false);
  const [mobileEditVisible, setMobileEditVisible] = useState(false);
  const [mobileEditingId, setMobileEditingId] = useState<number | null>(null);
  const [mobileEditingData, setMobileEditingData] = useState<TransactionFormData | null>(null);
  // const [categoryRefreshKey, setCategoryRefreshKey] = useState(0); // 暂时注释掉未使用的变量

  const openMobileEdit = (tx: Transaction) => {
    setMobileEditingId(tx.id);
    setMobileEditingData({
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      description: tx.description,
      date: dayjs(tx.date)
    });
    setMobileEditVisible(true);
  };

  const closeMobileEdit = () => {
    setMobileEditVisible(false);
    setMobileEditingId(null);
    setMobileEditingData(null);
  };

  const submitMobileEdit = async (formData: TransactionFormData) => {
    if (mobileEditingId != null) {
      await updateTransactionMutation.mutateAsync({ id: mobileEditingId, formData });
      closeMobileEdit();
    }
  };

  return (
    <ConfigProvider locale={zhCN}>
      <AntdApp>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ 
          color: '#fff', 
          fontSize: isMobile ? 16 : 18,
          padding: isMobile ? '0 16px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          记账本
        </Header>
        <Content style={{ 
          padding: isMobile ? 8 : 24,
          backgroundColor: isMobile ? '#f5f5f5' : 'transparent'
        }}>
          {isMobile ? (
            // 移动端布局
            <div style={{ maxWidth: '100%', margin: '0 auto' }}>
              <MobileTransactionList
                transactions={transactions}
                loading={loading}
                onEdit={openMobileEdit}
                onDelete={handleDeleteTransaction}
                onExport={() => setMobileExportVisible(true)}
                onImport={() => setMobileImportVisible(true)}
                onBatchDelete={(type) => {
                  if (type === 'all' && transactions.length > 0) {
                    modal.confirm({
                      title: '确认删除',
                      content: `确定要删除全部 ${transactions.length} 条交易记录吗？此操作不可恢复。`,
                      okText: '确定',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: async () => {
                        try {
                          const ids = transactions.map(t => t.id);
                          // 逐条删除，避免缺少批量接口
                          for (const id of ids) {
                            await deleteTransactionMutation.mutateAsync(id);
                          }
                          message.success('已删除所有记录');
                          queryClient.invalidateQueries({ queryKey: ['transactions'] });
                        } catch (e: any) {
                          message.error(e?.message || '删除失败，请重试');
                        }
                      }
                    });
                  }
                }}
                showVoiceInput={false}
              />

              {/* Mobile Export Modal */}
              {isMobile && (
                <ExportModal
                  visible={mobileExportVisible}
                  onCancel={() => setMobileExportVisible(false)}
                  transactions={transactions}
                  title="导出交易记录"
                />
              )}

              {/* Mobile Import Modal */}
              {isMobile && (
                <ImportModal
                  visible={mobileImportVisible}
                  onCancel={() => setMobileImportVisible(false)}
                  onSuccess={() => {
                    setMobileImportVisible(false);
                    queryClient.invalidateQueries({ queryKey: ['transactions'] });
                  }}
                />
              )}

              {/* Mobile Edit Modal */}
              {isMobile && (
                <EditTransactionModal
                  visible={mobileEditVisible}
                  onCancel={closeMobileEdit}
                  onOk={submitMobileEdit}
                  onCategoryChange={handleCategoryChange}
                  onNavigateToCategoryManager={handleNavigateToCategoryManager}
                  initialData={mobileEditingData || {
                    type: 'expense',
                    category: '',
                    amount: 0,
                    description: '',
                    date: undefined
                  }}
                />
              )}
            </div>
          ) : (
            // 桌面端布局
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10} lg={8}>
                <Card title="新增交易" variant="outlined">
                  <TransactionForm 
                    onSubmit={handleAddTransaction} 
                    onCategoryChange={handleCategoryChange}
                    onNavigateToCategoryManager={handleNavigateToCategoryManager}
                  />
                </Card>
              </Col>
              <Col xs={24} md={14} lg={16}>
                <Row gutter={[0, 16]}>
                  <Col span={24}>
                    {/* 筛选条件 */}
                    <EnhancedSearch 
                      onFilterChange={handleFilterChange}
                      categories={Array.from(new Set(transactions.map(t => t.category).filter(Boolean)))}
                    />
                  </Col>
                  <Col span={24}>
                    {/* 顶部卡片：交易记录 */}
                    <Card title="交易记录" variant="outlined">
                      <TransactionList 
                        transactions={transactions} 
                        loading={loading}
                        filters={filters}
                        onDelete={handleDeleteTransaction}
                        onUpdate={handleUpdateTransaction}
                      />
                    </Card>
                  </Col>
                  <Col span={24}>
                    {/* 下方卡片：财务概览（包裹 Dashboard） */}
                    <Card title="财务概览" variant="outlined">
                      <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>}>
                        <Dashboard 
                          transactions={transactions} 
                          activeTab={activeTab}
                          onTabChange={setActiveTab}
                          showCreateCategoryModal={showCreateCategoryModal}
                          onCategoryModalClose={handleCategoryModalClose}
                        />
                      </Suspense>
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>
          )}
        </Content>
      </Layout>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;