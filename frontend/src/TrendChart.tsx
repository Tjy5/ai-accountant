import React, { useMemo, useState, memo } from 'react';
import { Empty, Typography, Radio } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

interface TrendChartProps {
  transactions: Transaction[];
}

type PeriodType = 'week' | 'month';

interface ChartDataPoint {
  period: string;
  income: number;
  expense: number;
  net: number;
}

const TrendChartComponent: React.FC<TrendChartProps> = ({ transactions }) => {
  const [periodType, setPeriodType] = useState<PeriodType>('month');

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // 按时间段分组数据
    const periodMap = new Map<string, { income: number; expense: number }>();

    transactions.forEach(transaction => {
      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      const date = dayjs(transaction.date);
      let periodKey: string;

      if (periodType === 'week') {
        // 按周分组：获取该周的周一日期作为key
        const startOfWeek = date.startOf('week').add(1, 'day'); // 周一
        periodKey = startOfWeek.format('YYYY-MM-DD');
      } else {
        // 按月分组
        periodKey = date.format('YYYY-MM');
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, { income: 0, expense: 0 });
      }

      const periodData = periodMap.get(periodKey)!;
      if (transaction.type === 'income') {
        periodData.income += amount;
      } else if (transaction.type === 'expense') {
        periodData.expense += amount;
      }
    });

    // 转换为图表数据格式并排序
    const result = Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period: periodType === 'week' 
          ? `${dayjs(period).format('MM-DD')}周` 
          : dayjs(period).format('YYYY年MM月'),
        income: Number(data.income.toFixed(2)),
        expense: Number(data.expense.toFixed(2)),
        net: Number((data.income - data.expense).toFixed(2))
      }))
      .sort((a, b) => {
        // 根据原始period字符串排序
        const aKey = periodType === 'week' 
          ? dayjs(a.period.replace('周', ''), 'MM-DD').valueOf()
          : dayjs(a.period, 'YYYY年MM月').valueOf();
        const bKey = periodType === 'week'
          ? dayjs(b.period.replace('周', ''), 'MM-DD').valueOf()
          : dayjs(b.period, 'YYYY年MM月').valueOf();
        return aKey - bKey;
      });

    return result;
  }, [transactions, periodType]);

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
              {item.name === 'income' && '收入: '}
              {item.name === 'expense' && '支出: '}
              {item.name === 'net' && '净收支: '}
              ¥{item.value.toFixed(2)}
            </p>
          ))}
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
          收支趋势分析
        </Typography.Title>
        <Radio.Group 
          value={periodType} 
          onChange={(e) => setPeriodType(e.target.value)}
          size="small"
        >
          <Radio.Button value="week">按周</Radio.Button>
          <Radio.Button value="month">按月</Radio.Button>
        </Radio.Group>
      </div>
      
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="income" 
              name="收入"
              stroke="#52c41a" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="expense" 
              name="支出"
              stroke="#ff4d4f" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="net" 
              name="净收支"
              stroke="#1890ff" 
              strokeWidth={2}
              dot={{ r: 4 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Empty 
          description={`暂无${periodType === 'week' ? '周' : '月'}度数据`}
          style={{ padding: '40px 0' }} 
        />
      )}
    </div>
  );
};

const TrendChart = memo(TrendChartComponent);
export default TrendChart;