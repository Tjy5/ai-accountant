import React, { useState, useMemo } from 'react';
import { Table, Tag, Typography, Button, Space, Modal, App as AntdApp } from 'antd';
import { AudioOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import type { TransactionFormData } from './TransactionForm';
import type { FilterParams } from './FilterBar';
import dayjs from 'dayjs';
import EditTransactionModal from './EditTransactionModal';
import ExportModal from './ExportModal';
import ImportModal from './ImportModal';
import VirtualizedTable from './components/VirtualizedTable';
import TagList from './components/TagList';
import { TABLE } from './constants/ui';
import { LoadingSpinner, EmptyState } from './components/Status';
import SmartPagination from './components/SmartPagination';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  is_voice_input?: boolean; // 标识是否通过语音输入创建
  voice_input_text?: string; // 存储语音转文字的原始内容
  tags?: string[] | string;
}

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  filters?: FilterParams;
  onDelete: (id: number) => void;
  onUpdate: (id: number, formData: TransactionFormData) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, loading, onDelete, onUpdate }) => {
  const { modal } = AntdApp.useApp();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionFormData | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showVoiceInputColumn, setShowVoiceInputColumn] = useState<boolean>(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);


  const handleEdit = (record: Transaction) => {
    setEditingTransaction({
      type: record.type,
      category: record.category,
      amount: record.amount,
      description: record.description,
      date: dayjs(record.date)
    });
    setEditingId(record.id);
    setEditModalVisible(true);
  };

  const handleEditCancel = () => {
    setEditModalVisible(false);
    setEditingTransaction(null);
    setEditingId(null);
  };

  const handleEditOk = async (formData: TransactionFormData) => {
    if (editingId) {
      await onUpdate(editingId, formData);
      handleEditCancel();
    }
  };

  // 不再需要筛选，显示所有记录
  const filteredTransactions = transactions;

  // 智能决定是否使用虚拟滚动
  const shouldUseVirtualization = filteredTransactions.length > 50;

  // 分页数据处理
  const paginatedData = useMemo(() => {
    if (shouldUseVirtualization) {
      // 大数据量时使用虚拟滚动，显示所有数据
      return filteredTransactions;
    } else {
      // 小数据量时使用传统分页
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return filteredTransactions.slice(startIndex, endIndex);
    }
  }, [filteredTransactions, currentPage, pageSize, shouldUseVirtualization]);

  // 分页变化处理
  const handlePaginationChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };



  const handleBatchDelete = (batchDeleteType: 'all' | 'filtered' | 'selected') => {
    // 现在必须传入删除类型参数
    const transactionsToDelete = getTransactionsToDeleteByType(batchDeleteType);
    console.log('批量删除：准备删除', transactionsToDelete.length, '条记录，删除类型:', batchDeleteType);
    
    if (transactionsToDelete.length === 0) {
      Modal.warning({
        title: '提示',
        content: '没有可删除的记录'
      });
      return;
    }

    // 显示确认对话框
    modal.confirm({
      title: '确认删除',
      content: `确定要删除${transactionsToDelete.length}条交易记录吗？此操作不可恢复！`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        console.log('批量删除确认，开始删除', transactionsToDelete.length, '条记录');
        executeBatchDelete(transactionsToDelete);
      },
      onCancel: () => {
        console.log('用户取消了批量删除操作');
      }
    });
  };

  // 新增：根据类型获取要删除的记录
  const getTransactionsToDeleteByType = (type: 'all' | 'filtered' | 'selected') => {
    console.log('getTransactionsToDeleteByType被调用，type:', type);
    console.log('selectedRowKeys:', selectedRowKeys);
    console.log('transactions总数:', transactions.length);
    
    let result: Transaction[];
    switch (type) {
      case 'all':
        result = transactions;
        console.log('选择全部删除，返回所有记录:', result.length);
        break;
      case 'filtered':
        // 删除当前显示的所有记录（已经经过筛选的）
        result = transactions;
        console.log('选择按筛选删除，返回当前筛选后的记录:', result.length);
        break;
      case 'selected':
        result = transactions.filter(t => selectedRowKeys.includes(t.id));
        console.log('选择删除选中，返回选中记录:', result.length);
        console.log('选中的记录ID:', selectedRowKeys);
        break;
      default:
        result = [];
        console.log('未知的删除类型，返回空数组');
    }
    
    console.log('最终要删除的记录:', result.map(t => ({ id: t.id, description: t.description })));
    return result;
  };

  // 新增：执行批量删除的函数
  const executeBatchDelete = async (transactionsToDelete: Transaction[]) => {
    console.log('开始执行批量删除，共', transactionsToDelete.length, '条记录');
    try {
      // 批量删除
      for (const transaction of transactionsToDelete) {
        console.log('正在删除记录ID:', transaction.id);
        await onDelete(transaction.id);
        console.log('记录ID:', transaction.id, '删除完成');
      }
      console.log('所有记录删除完成');
      setSelectedRowKeys([]);
      Modal.success({
        title: '删除成功',
        content: `成功删除${transactionsToDelete.length}条记录`
      });
    } catch (error) {
      console.error('批量删除过程中出错:', error);
      Modal.error({
        title: '删除失败',
        content: '部分记录删除失败，请重试'
      });
    }
  };

  const columns: TableProps<Transaction>["columns"] = [
    {
      title: '记账时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
      width: 140,
      responsive: ['md']
    },
    {
      title: '交易日期',
      dataIndex: 'date',
      key: 'date',
      render: (value: string) => new Date(value).toLocaleDateString('zh-CN'),
      width: 100
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (value: 'income' | 'expense') => (
        value === 'income' ? <Tag color="green">收入</Tag> : <Tag color="red">支出</Tag>
      ),
      width: 70
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 80
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (_: unknown, record: Transaction) => (
        <span style={{ color: record.type === 'income' ? '#389e0d' : '#cf1322' }}>
          {record.type === 'income' ? '+' : '-'}{record.amount.toFixed(2)}
        </span>
      ),
      width: 100
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      render: (text?: string) => {
        if (!text || !text.trim()) return '-';
        
        return (
          <div style={{ 
            maxWidth: '150px',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4'
          }}>
            {text}
          </div>
        );
      },
      width: 150
    },
    {
      title: '标签',
      key: 'tags',
      render: (_: unknown, record: Transaction) => (
        <TagList value={record.tags as any} max={3} />
      ),
      width: 200
    },
    ...(showVoiceInputColumn ? [{
      title: '语音转文字',
      key: 'voice_input_text',
      render: (_: unknown, record: Transaction) => {
        if (!record.voice_input_text) return '-';
        
        return (
          <div style={{ 
            maxWidth: '200px',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4',
            color: '#1890ff'
          }}>
            {record.voice_input_text}
          </div>
        );
      },
      width: 200
    }] : []),
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Transaction) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            size="small" 
            danger
            onClick={() => {
              console.log('删除按钮被点击，记录ID:', record.id);
              modal.confirm({
                title: '确认删除',
                content: `确定要删除这条交易记录吗？`,
                okText: '确定',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: () => {
                  console.log('确认删除，调用onDelete函数，ID:', record.id);
                  onDelete(record.id);
                },
                onCancel: () => {
                  console.log('用户取消了删除操作');
                }
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
      width: 100,
      fixed: 'right'
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>交易记录总览</Typography.Title>
        </div>
        <Space wrap size="small">
          <Button
            type={showVoiceInputColumn ? 'primary' : 'default'}
            onClick={() => setShowVoiceInputColumn(!showVoiceInputColumn)}
            icon={<AudioOutlined />}
            size="small"
          >
            {showVoiceInputColumn ? '隐藏语音转文字' : '显示语音转文字'}
          </Button>
          <Button
            type="default"
            onClick={() => setExportModalVisible(true)}
            icon={<DownloadOutlined />}
            size="small"
          >
            导出数据
          </Button>
          <Button
            type="default"
            onClick={() => setImportModalVisible(true)}
            icon={<UploadOutlined />}
            size="small"
          >
            导入数据
          </Button>
          <Button
            type="default"
            onClick={() => {
              console.log('全部删除按钮被点击');
              handleBatchDelete('all');
            }}
            icon={<DeleteOutlined />}
            danger
            size="small"
          >
            全部删除
          </Button>
          <Button
            type="default"
            onClick={() => {
              console.log('按筛选删除按钮被点击');
              handleBatchDelete('filtered');
            }}
            icon={<DeleteOutlined />}
            danger
            size="small"
          >
            按筛选删除
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              onClick={() => {
                console.log('删除选中按钮被点击，当前selectedRowKeys:', selectedRowKeys);
                console.log('直接调用handleBatchDelete with selected type');
                handleBatchDelete('selected');
              }}
              icon={<DeleteOutlined />}
              danger
              size="small"
            >
              删除选中 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : shouldUseVirtualization ? (
        <VirtualizedTable
          rowKey="id"
          columns={columns}
          dataSource={paginatedData}
          loading={false}
          enableVirtualization={true}
          height={TABLE.virtualHeight}
          itemHeight={TABLE.virtualItemHeight}
          scroll={{ x: TABLE.scrollX }}
          size="small"
        />
      ) : (
        <>
          {paginatedData.length === 0 ? (
            <EmptyState description="暂无交易记录" />
          ) : (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={paginatedData}
              loading={false}
              pagination={false}
              rowSelection={{
                selectedRowKeys,
                onChange: (newSelectedRowKeys) => {
                  setSelectedRowKeys(newSelectedRowKeys);
                },
              }}
              scroll={{ x: TABLE.scrollX }}
              size="small"
            />
          )}
          
          <div style={{ marginTop: 16 }}>
            <SmartPagination
              total={filteredTransactions.length}
              current={currentPage}
              pageSize={pageSize}
              onChange={handlePaginationChange}
              loading={loading}
              showStatistics={true}
            />
          </div>
        </>
      )}
      
      <EditTransactionModal
        visible={editModalVisible}
        onCancel={handleEditCancel}
        onOk={handleEditOk}
        onCategoryChange={() => {
          // 可以在这里添加分类变化的处理逻辑
        }}
        onNavigateToCategoryManager={() => {
          // 可以在这里添加跳转到分类管理页面的逻辑
        }}
        initialData={editingTransaction || {
          type: 'expense',
          category: '',
          amount: 0,
          description: '',
          date: undefined
        }}
      />
      
      <ExportModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        transactions={transactions}
        title="导出交易记录"
      />
      <ImportModal
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={() => {
          setImportModalVisible(false);
          // 刷新数据
          window.location.reload();
        }}
      />
    </div>
  );
};

export default TransactionList;
