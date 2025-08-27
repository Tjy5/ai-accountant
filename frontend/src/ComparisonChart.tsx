import React, { useMemo, useState, memo } from 'react';
import { Empty, Typography, Radio } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import dayjs from 'dayjs';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

interface ComparisonChartProps {
  transactions: Transaction[];
}

type ViewMode = 'monthly' | 'category';

interface MonthlyData {
  period: string;
  income: number;
  expense: number;
}

interface CategoryData {
  category: string;
  income: number;
  expense: number;
}

const ComparisonChartComponent: React.FC<ComparisonChartProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');

  const { monthlyData, categoryData } = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { monthlyData: [], categoryData: [] };
    }

    // 按月分组
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    // 按分类分组
    const categoryMap = new Map<string, { income: number; expense: number }>();

    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      // 月度数据
      const monthKey = dayjs(transaction.date).format('YYYY-MM');
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { income: 0, expense: 0 });
      }
      const monthData = monthlyMap.get(monthKey)!;

      // 分类数据
      const category = transaction.category || '未分类';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { income: 0, expense: 0 });
      }
      const catData = categoryMap.get(category)!;

      // 更新数据
      if (transaction.type === 'income') {
        monthData.income += amount;
        catData.income += amount;
      } else if (transaction.type === 'expense') {
        monthData.expense += amount;
        catData.expense += amount;
      }
    });

    // 转换为图表格式
    const monthlyResult: MonthlyData[] = Array.from(monthlyMap.entries())
      .map(([period, data]) => ({
        period: dayjs(period).format('YYYY年MM月'),
        income: Number(data.income.toFixed(2)),
        expense: Number(data.expense.toFixed(2))
      }))
      .sort((a, b) => dayjs(a.period, 'YYYY年MM月').valueOf() - dayjs(b.period, 'YYYY年MM月').valueOf());

    const categoryResult: CategoryData[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        income: Number(data.income.toFixed(2)),
        expense: Number(data.expense.toFixed(2))
      }))
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense)) // 按总金额排序
      .slice(0, 10); // 只显示前10个分类

    return { monthlyData: monthlyResult, categoryData: categoryResult };
  }, [transactions]);

  const chartData = viewMode === 'monthly' ? monthlyData : categoryData;
  const hasData = chartData.length > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          padding: 12, 
          backgroundColor: '#fff', 
          border: '1px solid #ccc', 
          borderRadius: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((item: any, index: number) => (
            <p key={index} style={{ margin: 0, color: item.color }}>
              {item.dataKey === 'income' && '收入: '}
              {item.dataKey === 'expense' && '支出: '}
              ¥{item.value.toFixed(2)}
            </p>
          ))}
          {payload.length >= 2 && (
            <p style={{ margin: 0, fontWeight: 'bold', borderTop: '1px solid #eee', paddingTop: 4 }}>
              净收支: ¥{(payload.find((p: any) => p.dataKey === 'income')?.value - 
                       payload.find((p: any) => p.dataKey === 'expense')?.value).toFixed(2)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16 
      }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          收支对比分析
        </Typography.Title>
        <Radio.Group 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value)}
          size="small"
        >
          <Radio.Button value="monthly">按月对比</Radio.Button>
          <Radio.Button value="category">按分类对比</Radio.Button>
        </Radio.Group>
      </div>
      
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={chartData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={viewMode === 'monthly' ? 'period' : 'category'}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="income" 
              name="收入"
              fill="#52c41a"
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="expense" 
              name="支出"
              fill="#ff4d4f"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty 
          description={`暂无${viewMode === 'monthly' ? '月度' : '分类'}数据`}
          style={{ padding: '40px 0' }} 
        />
      )}
      
      {hasData && viewMode === 'category' && categoryData.length >= 10 && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          * 仅显示金额最大的前10个分类
        </Typography.Text>
      )}
    </div>
  );
};

const ComparisonChart = memo(ComparisonChartComponent);
export default ComparisonChart;