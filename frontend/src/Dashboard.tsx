import React, { useState, useMemo } from 'react';
import { Empty, Tabs, Card, Row, Col, Statistic, Space, Select } from 'antd';
import { 
  PieChart, Pie, Cell, Tooltip, 
  Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
  ComposedChart
} from 'recharts';
import { 
  DollarOutlined
} from '@ant-design/icons';
import BudgetManager from './BudgetManager';
import NotificationSystem from './components/NotificationSystem';
import CategoryManager from './components/CategoryManager';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

interface DashboardProps {
  transactions: Transaction[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  showCreateCategoryModal?: boolean; // 新增：控制显示新建分类弹窗
  onCategoryModalClose?: () => void; // 新增：分类弹窗关闭回调
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#8dd1e1', '#d0ed57', '#a4de6c'];

const Dashboard: React.FC<DashboardProps> = ({ transactions, activeTab, onTabChange, showCreateCategoryModal, onCategoryModalClose }) => {
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const expenseTransactions = useMemo(() => (
    transactions.filter(t => t.type === 'expense')
  ), [transactions]);

  const incomeTransactions = useMemo(() => (
    transactions.filter(t => t.type === 'income')
  ), [transactions]);

  const pieData = React.useMemo(() => {
    const categoryToAmount = new Map<string, number>();
    for (const item of expenseTransactions) {
      if (!item.category || item.category.trim() === '') {
        continue;
      }
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }
      const prev = categoryToAmount.get(item.category) ?? 0;
      categoryToAmount.set(item.category, prev + amount);
    }
    return Array.from(categoryToAmount.entries())
      .filter(([category, amount]) => category && category.trim() !== '' && Number.isFinite(amount) && amount > 0)
      .map(([category, amount]) => ({ 
        name: category,
        value: amount 
      }));
  }, [expenseTransactions]);

  const isDataValid = pieData.length > 0 && pieData.every(item => Number.isFinite(item.value) && item.value > 0);

  // 按时间范围筛选数据
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const ranges = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    const days = ranges[timeRange];
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return transactions.filter(t => new Date(t.date) >= cutoffDate);
  }, [transactions, timeRange]);

  // 月度趋势数据
  const monthlyTrendData = useMemo(() => {
    const monthlyData = new Map<string, { income: number; expense: number; net: number }>();
    
    filteredTransactions.forEach(t => {
      const month = t.date.substring(0, 7); // YYYY-MM
      const current = monthlyData.get(month) || { income: 0, expense: 0, net: 0 };
      
      if (t.type === 'income') {
        current.income += t.amount;
        current.net += t.amount;
      } else {
        current.expense += t.amount;
        current.net -= t.amount;
      }
      
      monthlyData.set(month, current);
    });
    
    return Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: Number(data.income.toFixed(2)),
        expense: Number(data.expense.toFixed(2)),
        net: Number(data.net.toFixed(2))
      }));
  }, [filteredTransactions]);

  // 分类柱状图数据
  const categoryBarData = useMemo(() => {
    const categoryMap = new Map<string, { income: number; expense: number }>();
    
    filteredTransactions.forEach(t => {
      const current = categoryMap.get(t.category) || { income: 0, expense: 0 };
      if (t.type === 'income') {
        current.income += t.amount;
      } else {
        current.expense += t.amount;
      }
      categoryMap.set(t.category, current);
    });
    
    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        income: Number(data.income.toFixed(2)),
        expense: Number(data.expense.toFixed(2))
      }))
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
      .slice(0, 10); // 只显示前10个分类
  }, [filteredTransactions]);

  // 自定义 Recharts 工具提示
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (active && payload && payload.length) {
      const { name, value } = payload[0];
      if (Number.isFinite(value)) {
        return (
          <div style={{ padding: 6, backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 4 }}>
            <p style={{ margin: 0 }}>{`${name} : ¥${value.toFixed(2)}`}</p>
          </div>
        );
      }
    }
    return null;
  };

  const handleBudgetUpdate = () => {
    setBudgetRefreshKey(prev => prev + 1);
  };

  const handleCategoryChange = () => {
    // 当分类发生变化时，刷新预算管理器
    setBudgetRefreshKey(prev => prev + 1);
  };



  const tabItems = [
    {
      key: '1',
      label: '数据概览',
      children: (
        <div>
          {/* 统计概览 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总收入"
                  value={incomeTransactions.reduce((sum, t) => sum + t.amount, 0)}
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<DollarOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总支出"
                  value={expenseTransactions.reduce((sum, t) => sum + t.amount, 0)}
                  precision={2}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<DollarOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="净收入"
                  value={incomeTransactions.reduce((sum, t) => sum + t.amount, 0) - expenseTransactions.reduce((sum, t) => sum + t.amount, 0)}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                  prefix="↗"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="交易笔数"
                  value={transactions.length}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 时间范围选择 */}
          <Card style={{ marginBottom: 16 }}>
            <Space size="large">
              <span>时间范围：</span>
              <Select
                value={timeRange}
                onChange={setTimeRange}
                style={{ width: 100 }}
                options={[
                  { label: '7天', value: '7d' },
                  { label: '30天', value: '30d' },
                  { label: '90天', value: '90d' },
                  { label: '1年', value: '1y' },
                ]}
              />
            </Space>
          </Card>

          {/* 四个图表并排显示 */}
          <Row gutter={[16, 16]}>
            {/* 饼图 - 支出分布 */}
            <Col xs={24} lg={12}>
              <Card title="支出类别分布" size="small">
                {isDataValid ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无支出数据" />
                )}
              </Card>
            </Col>

            {/* 柱状图 - 分类收支对比 */}
            <Col xs={24} lg={12}>
              <Card title="分类收支对比" size="small">
                {categoryBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={categoryBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" angle={-45} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip formatter={(value) => `¥${value}`} />
                      <Bar dataKey="income" fill="#52c41a" name="收入" />
                      <Bar dataKey="expense" fill="#ff4d4f" name="支出" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>

            {/* 趋势线图 - 月度收支趋势 */}
            <Col xs={24} lg={12}>
              <Card title="月度收支趋势" size="small">
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `¥${value}`} />
                      <Line type="monotone" dataKey="income" stroke="#52c41a" strokeWidth={2} name="收入" />
                      <Line type="monotone" dataKey="expense" stroke="#ff4d4f" strokeWidth={2} name="支出" />
                      <Line type="monotone" dataKey="net" stroke="#1890ff" strokeWidth={2} name="净收入" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>

            {/* 面积图 - 月度收支面积 */}
            <Col xs={24} lg={12}>
              <Card title="月度收支面积" size="small">
                {monthlyTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `¥${value}`} />
                      <Area type="monotone" dataKey="income" stackId="1" stroke="#52c41a" fill="#52c41a" fillOpacity={0.6} name="收入" />
                      <Area type="monotone" dataKey="expense" stackId="1" stroke="#ff4d4f" fill="#ff4d4f" fillOpacity={0.6} name="支出" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: '2',
      label: '分类管理',
      children: <CategoryManager 
        onCategoryChange={handleCategoryChange} 
        showCreateModal={showCreateCategoryModal}
        onModalClose={onCategoryModalClose}
      />
    },
    {
      key: '3',
      label: '预算管理',
      children: <BudgetManager onBudgetUpdate={handleBudgetUpdate} onCategoryChange={handleCategoryChange} refreshKey={budgetRefreshKey} />
    },
    {
      key: '4',
      label: '通知系统',
      children: <NotificationSystem refreshKey={budgetRefreshKey} />
    }
  ];

  return (
    <div>
      {/* 数据可视化选项卡 */}
      <Tabs 
        items={tabItems}
        activeKey={activeTab}
        onChange={onTabChange}
        style={{ minHeight: 400 }}
      />
    </div>
  );
};

export default Dashboard;