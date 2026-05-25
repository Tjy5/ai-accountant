import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axiosInstance';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SummaryData {
  income: number;
  expense: number;
  net: number;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface TransactionData {
  id: string | number;
  type: string;
  category: string;
  amount: number;
  description?: string;
  date?: string;
}

const COLORS = ['#FFD1DC', '#C2F2D0', '#FFF2B2', '#FFB87A', '#B5E2FF'];

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍣',
  groceries: '🛒',
  rent: '🏠',
  transport: '🚌',
  salary: '💰',
  income: '🌱',
  shopping: '🛍️',
};

const toNumber = (value: unknown) => Number(value || 0);

const emojiForTransaction = (transaction: TransactionData) => {
  const text = `${transaction.category} ${transaction.description || ''} ${transaction.type}`.toLowerCase();
  const match = Object.entries(CATEGORY_EMOJIS).find(([keyword]) => text.includes(keyword));
  return match?.[1] || (transaction.type === 'income' ? '🌱' : '🧾');
};

const formatDate = (date?: string) => date?.slice(0, 10) || 'Today';

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  
  const [summary, setSummary] = useState<SummaryData>({ income: 0, expense: 0, net: 0 });
  const [expenseData, setExpenseData] = useState<ChartData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [summaryRes, chartsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/charts')
        ]);
        
        setSummary({
          income: toNumber(summaryRes.data.totals?.income),
          expense: toNumber(summaryRes.data.totals?.expense),
          net: toNumber(summaryRes.data.totals?.net)
        });
        setRecentTransactions((summaryRes.data.recentTransactions || []).map((transaction: TransactionData) => ({
          ...transaction,
          amount: toNumber(transaction.amount),
        })));
        
        // Map backend chart data to Recharts format
        const mappedCharts = chartsRes.data.categoryShare?.map((item: { category: string; total: number }, i: number) => ({
          name: item.category,
          value: toNumber(item.total),
          color: COLORS[i % COLORS.length]
        })) || [];
        setExpenseData(mappedCharts);
      } catch {
        console.warn('Backend not reachable, using mock data for UI visualization');
        // Fallback mock data for visual demonstration
        setSummary({ income: 4500, expense: 2300, net: 2200 });
        setExpenseData([
          { name: 'Food 🍣', value: 800, color: '#FFD1DC' },
          { name: 'Rent 🏠', value: 1200, color: '#C2F2D0' },
          { name: 'Transport 🚌', value: 300, color: '#FFF2B2' },
        ]);
        setRecentTransactions([
          { id: 'mock-1', type: 'expense', category: 'Food', amount: 45, description: 'Sushi lunch', date: new Date().toISOString() },
          { id: 'mock-2', type: 'income', category: 'Salary', amount: 4500, description: 'Monthly salary', date: new Date().toISOString() },
          { id: 'mock-3', type: 'expense', category: 'Transport', amount: 12, description: 'Bus pass', date: new Date().toISOString() },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Hello, {user?.name || user?.email || 'Friend'}! 👋
        </h1>
        <p className="text-gray-500 mt-2">Here is your financial summary.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 text-macaron-pink">Loading...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-macaron-mint/30 border-none">
              <h3 className="text-sm font-semibold text-emerald-700 uppercase">Net Worth</h3>
              <p className="text-3xl font-bold text-emerald-900 mt-2">${summary.net.toFixed(2)}</p>
            </Card>
            <Card className="bg-macaron-pink/30 border-none">
              <h3 className="text-sm font-semibold text-pink-700 uppercase">Total Expenses</h3>
              <p className="text-3xl font-bold text-pink-900 mt-2">${summary.expense.toFixed(2)}</p>
            </Card>
            <Card className="bg-macaron-yellow/40 border-none">
              <h3 className="text-sm font-semibold text-yellow-700 uppercase">Total Income</h3>
              <p className="text-3xl font-bold text-yellow-900 mt-2">${summary.income.toFixed(2)}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Charts Section */}
            <Card className="lg:col-span-2">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Expenses by Category</h2>
              <div className="h-80 w-full flex justify-center">
                {expenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 4px 14px 0 rgba(0,0,0,0.05)' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center text-gray-400">No data available</div>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Recent Transactions</h2>
                <p className="text-sm text-gray-500 mt-1">Your latest account activity.</p>
              </div>
              <span className="bg-macaron-mint/40 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                {recentTransactions.length}
              </span>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="rounded-cute bg-cute-bg p-6 text-center text-gray-400 font-medium">
                No recent transactions yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-4 rounded-cute bg-cute-bg px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 shrink-0 rounded-full bg-white shadow-sm flex items-center justify-center text-xl">
                        {emojiForTransaction(transaction)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">
                          {transaction.description || transaction.category}
                        </p>
                        <p className="text-xs text-gray-500 font-semibold">
                          {transaction.category} · {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <p className={`font-black whitespace-nowrap ${transaction.type === 'income' ? 'text-emerald-700' : 'text-pink-700'}`}>
                      {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
