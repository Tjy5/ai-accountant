import React, { useState, useMemo } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  Drawer, 
  Empty, 
  FloatButton,
  Badge,
  Tabs,
  Statistic,
  Row,
  Col
} from 'antd';
import { 
  PlusOutlined, 
  FilterOutlined, 
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  AudioOutlined
} from '@ant-design/icons';
import MobileTransactionCard from './MobileTransactionCard';
import SmartPagination from './SmartPagination';

const { Text } = Typography;

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  is_voice_input?: boolean;
  voice_input_text?: string;
}

interface MobileTransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
  onExport: () => void;
  onImport: () => void;
  onBatchDelete: (type: 'all' | 'filtered') => void;
  showVoiceInput?: boolean;
}

const MobileTransactionList: React.FC<MobileTransactionListProps> = ({
  transactions,
  loading,
  onEdit,
  onDelete,
  onExport,
  onImport,
  onBatchDelete,
  showVoiceInput = false
}) => {
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');

  // 统计数据
  const statistics = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expense;

    return { income, expense, balance };
  }, [transactions]);

  // 按类型筛选
  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions;
    return transactions.filter(t => t.type === activeTab);
  }, [transactions, activeTab]);

  // 分页数据
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, pageSize]);

  const handlePaginationChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const tabItems = [
    {
      key: 'all',
      label: (
        <Badge count={transactions.length} showZero size="small">
          <span>全部</span>
        </Badge>
      ),
    },
    {
      key: 'income',
      label: (
        <Badge 
          count={transactions.filter(t => t.type === 'income').length} 
          showZero 
          size="small"
          color="green"
        >
          <span>收入</span>
        </Badge>
      ),
    },
    {
      key: 'expense',
      label: (
        <Badge 
          count={transactions.filter(t => t.type === 'expense').length} 
          showZero 
          size="small"
          color="red"
        >
          <span>支出</span>
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* 统计卡片 */}
      <Card 
        style={{ 
          marginBottom: 16,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
        styles={{ body: { padding: '16px' } }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title={<span style={{ color: 'white', fontSize: '12px' }}>收入</span>}
              value={statistics.income}
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: '18px', fontWeight: 'bold' }}
              prefix="+"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ color: 'white', fontSize: '12px' }}>支出</span>}
              value={statistics.expense}
              precision={2}
              valueStyle={{ color: '#ff4d4f', fontSize: '18px', fontWeight: 'bold' }}
              prefix="-"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ color: 'white', fontSize: '12px' }}>余额</span>}
              value={statistics.balance}
              precision={2}
              valueStyle={{ 
                color: statistics.balance >= 0 ? '#52c41a' : '#ff4d4f', 
                fontSize: '18px', 
                fontWeight: 'bold' 
              }}
              prefix={statistics.balance >= 0 ? '+' : ''}
            />
          </Col>
        </Row>
      </Card>

      {/* 操作按钮 */}
      <Card 
        style={{ marginBottom: 16, borderRadius: 12 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space wrap size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={onExport}
            size="small"
          >
            导出
          </Button>
          
          <Button
            icon={<UploadOutlined />}
            onClick={onImport}
            size="small"
          >
            导入
          </Button>
          
          <Button
            icon={<AudioOutlined />}
            type={showVoiceInput ? 'primary' : 'default'}
            size="small"
          >
            语音
          </Button>
          
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => onBatchDelete('all')}
            size="small"
          >
            清空
          </Button>
        </Space>
      </Card>

      {/* 类型筛选标签 */}
      <Card 
        style={{ marginBottom: 16, borderRadius: 12 }}
        styles={{ body: { padding: '8px 0' } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'all' | 'income' | 'expense');
            setCurrentPage(1);
          }}
          centered
          size="small"
          items={tabItems}
        />
      </Card>

      {/* 交易记录列表 */}
      {paginatedData.length > 0 ? (
        <>
          <div style={{ padding: '0 8px' }}>
            {paginatedData.map((transaction) => (
              <MobileTransactionCard
                key={transaction.id}
                transaction={transaction}
                onEdit={onEdit}
                onDelete={onDelete}
                showVoiceInput={showVoiceInput}
              />
            ))}
          </div>

          {/* 分页 */}
          {filteredTransactions.length > pageSize && (
            <Card 
              style={{ marginTop: 16, borderRadius: 12 }}
              styles={{ body: { padding: '12px' } }}
            >
              <SmartPagination
                total={filteredTransactions.length}
                current={currentPage}
                pageSize={pageSize}
                onChange={handlePaginationChange}
                loading={loading}
                showStatistics={false}
              />
            </Card>
          )}
        </>
      ) : (
        <Card style={{ borderRadius: 12 }}>
          <Empty 
            description={
              <Space direction="vertical">
                <Text type="secondary">暂无交易记录</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  点击右下角"+"按钮添加记录
                </Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}

      {/* 浮动操作按钮 */}
      <FloatButton.Group 
        shape="circle" 
        style={{ right: 16, bottom: 16 }}
      >
        <FloatButton 
          icon={<FilterOutlined />} 
          onClick={() => setFilterDrawerVisible(true)}
          tooltip="筛选"
        />
        <FloatButton 
          icon={<PlusOutlined />} 
          type="primary"
          tooltip="添加记录"
        />
      </FloatButton.Group>

      {/* 筛选抽屉 */}
      <Drawer
        title="筛选选项"
        placement="bottom"
        onClose={() => setFilterDrawerVisible(false)}
        open={filterDrawerVisible}
        height="50%"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Text>筛选功能开发中...</Text>
          <Button 
            onClick={() => setFilterDrawerVisible(false)}
            size="large"
            block
          >
            关闭
          </Button>
        </Space>
      </Drawer>
    </div>
  );
};

export default MobileTransactionList;
