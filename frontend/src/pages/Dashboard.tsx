import { useEffect, useState, useRef } from 'react';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { useAuthStore } from '../store/useAuthStore';
import { useDraftStore } from '../store/useDraftStore';
import type { DraftTransaction } from '../store/useDraftStore';
import api from '../api/axiosInstance';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import {
  Search,
  Bell,
  Camera,
  Send,
  X,
  Edit2,
  Trash2,
  Save,
  PawPrint
} from 'lucide-react';

interface SummaryData {
  balance: number;
  income: number;
  expense: number;
  savings: number;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
  percentage: number;
  amount: number;
}

interface TransactionData {
  id: string | number;
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  icon: string;
}

const DONUT_COLORS = ['#FF8C94', '#64B5F6', '#FFD54F', '#BA68C8', '#A1887F'];
const NOTE_BACKGROUNDS = [
  'bg-[#FFD1DC]', // macaron pink
  'bg-[#C2F2D0]', // macaron mint
  'bg-[#FFF2B2]', // macaron yellow
  'bg-[#B5E2FF]'  // pastel blue
];

const TRANSACTION_ICON_KEYWORDS: Array<[string, string]> = [
  ['starbucks', '☕'],
  ['coffee', '☕'],
  ['bus', '🚌'],
  ['taxi', '🚕'],
  ['transport', '🚌'],
  ['salary', '💵'],
  ['income', '💵'],
  ['pizza', '🍕'],
  ['shopping', '🛍️'],
  ['grocer', '🛒'],
  ['food', '☕'],
];

const iconForTransaction = (transaction: Pick<TransactionData, 'type' | 'category' | 'description'>) => {
  const haystack = `${transaction.description} ${transaction.category} ${transaction.type}`.toLowerCase();
  const match = TRANSACTION_ICON_KEYWORDS.find(([keyword]) => haystack.includes(keyword));
  return match?.[1] || (transaction.type === 'income' ? '💵' : '🧾');
};

const formatTransactionDate = (date?: string) => {
  if (!date) return 'Today';
  const value = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return date;
  return value.slice(5).replace('-', '/');
};



const Thumbtack = () => (
  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 z-20 pointer-events-none">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M12 12V22" stroke="#4E3629" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="12" cy="10" rx="7" ry="4.5" fill="#FF5E5E" stroke="#4E3629" strokeWidth="3"/>
      <circle cx="12" cy="6" r="4" fill="#FF5E5E" stroke="#4E3629" strokeWidth="3"/>
      <circle cx="10.5" cy="5" r="1.5" fill="white"/>
    </svg>
  </div>
);

const CurledCorner = () => (
  <div className="cute-page-curl"></div>
);

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const { drafts, addDrafts, updateDraft, removeDraft, clearDrafts } = useDraftStore();
  const rawDisplayName = user?.name || 'Sarah';
  const displayName = /^\d+$/.test(rawDisplayName.trim()) ? 'Sarah' : rawDisplayName;

  // Dashboard states
  const [summary, setSummary] = useState<SummaryData>({
    balance: 4560.80,
    income: 5200.00,
    expense: 1820.20,
    savings: 1380.60
  });

  const [expenseData, setExpenseData] = useState<ChartData[]>([
    { name: 'Food & Dining', value: 35, percentage: 35, amount: 637.07, color: '#FF8C94' },
    { name: 'Transport', value: 25, percentage: 25, amount: 455.05, color: '#64B5F6' },
    { name: 'Shopping', value: 20, percentage: 20, amount: 364.04, color: '#FFD54F' },
    { name: 'Entertainment', value: 12, percentage: 12, amount: 218.42, color: '#BA68C8' },
    { name: 'Others', value: 8, percentage: 8, amount: 145.62, color: '#A1887F' },
  ]);

  const [recentTransactions, setRecentTransactions] = useState<TransactionData[]>([
    { id: 1, type: 'expense', category: 'Food', amount: 6.50, description: 'Starbucks Coffee', date: 'Today', icon: '☕' },
    { id: 2, type: 'expense', category: 'Transport', amount: 2.20, description: 'Bus Fare', date: 'Today', icon: '🚌' },
    { id: 3, type: 'income', category: 'Salary', amount: 5200.00, description: 'Salary', date: 'Oct 26', icon: '💵' },
    { id: 4, type: 'expense', category: 'Food', amount: 28.90, description: 'Pizza Night', date: 'Oct 25', icon: '🍕' },
    { id: 5, type: 'expense', category: 'Shopping', amount: 65.10, description: 'Online Shopping', date: 'Oct 25', icon: '🛍️' },
  ]);

  // AI input states
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DraftTransaction>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Open drawer automatically when drafts populate
    if (drafts.length > 0) {
      setDrawerOpen(true);
    } else {
      setDrawerOpen(false);
    }
  }, [drafts]);

  // Fetch Dashboard Stats from Backend (if live)
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [summaryRes, chartsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/charts')
        ]);

        // Parse and merge backend stats
        const inc = Number(summaryRes.data.totals?.income || 5200.00);
        const exp = Number(summaryRes.data.totals?.expense || 1820.20);
        const bal = Number(summaryRes.data.totals?.net || 4560.80);
        const sav = Number(summaryRes.data.totals?.savings || 1380.60);

        setSummary({
          balance: bal,
          income: inc,
          expense: exp,
          savings: sav
        });

        // Transactions list mapping
        if (summaryRes.data.recentTransactions && summaryRes.data.recentTransactions.length > 0) {
          const list = summaryRes.data.recentTransactions.slice(0, 5).map((t: any, idx: number) => {
            const mapped = {
              id: t.id || idx,
              type: t.type,
              category: t.category,
              amount: Number(t.amount),
              description: t.description || t.category,
              date: formatTransactionDate(t.date),
              icon: ''
            };

            return {
              ...mapped,
              icon: iconForTransaction(mapped)
            };
          });
          setRecentTransactions(list);
        }

        // Charts data mapping
        if (chartsRes.data.categoryShare && chartsRes.data.categoryShare.length > 0) {
          const totalVal = chartsRes.data.categoryShare.reduce((sum: number, c: any) => sum + Number(c.total || 0), 0);
          const mapped = chartsRes.data.categoryShare.slice(0, 5).map((item: any, i: number) => {
            const amt = Number(item.total);
            const pct = totalVal > 0 ? Math.round((amt / totalVal) * 100) : 0;
            return {
              name: item.category,
              value: amt,
              percentage: pct,
              amount: amt,
              color: DONUT_COLORS[i % DONUT_COLORS.length]
            };
          });
          setExpenseData(mapped);
        }
      } catch {
        console.warn('Backend not reachable, displaying default cute mockup stats');
      }
    };

    fetchDashboardData();
  }, []);

  const handleTextAnalyze = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    try {
      const response = await api.post('/ai/analyze', { text: textInput });
      addDrafts(response.data.drafts || []);
      setTextInput('');
    } catch {
      console.warn('Backend not available, adding mockup draft card');
      const mockDraft: DraftTransaction = {
        id: `draft_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        amount: parseFloat((Math.random() * 50 + 5).toFixed(2)),
        category: 'Food',
        description: textInput,
        type: 'expense'
      };
      addDrafts([mockDraft]);
      setTextInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploading(true);
      try {
        const response = await api.post('/ai/analyze-image', { image: base64, text: file.name });
        addDrafts(response.data.drafts || []);
      } catch {
        console.warn('Backend not available, adding receipt scan draft card');
        const mockDraft: DraftTransaction = {
          id: `draft_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          amount: 85.50,
          category: 'Groceries',
          description: 'Receipt: Supermarket scan',
          type: 'expense'
        };
        addDrafts([mockDraft]);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCommitDraft = async (draftId: string) => {
    try {
      const draft = drafts.find(d => d.id === draftId);
      if (!draft) return;
      await api.post('/ai/transactions/commit', { drafts: [{ ...draft, confirmed: true }] });
      removeDraft(draftId);
    } catch {
      removeDraft(draftId);
    }
  };

  const handleCommitAll = async () => {
    try {
      const commits = drafts.map(d => ({ ...d, confirmed: true }));
      await api.post('/ai/transactions/commit', { drafts: commits });
      clearDrafts();
    } catch {
      clearDrafts();
    }
  };

  return (
    <div className="dashboard-page flex flex-col gap-4 relative flex-grow min-h-0 h-full">
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-[32px] leading-tight font-black text-[#2F2925] tracking-tight">
            Good morning, {displayName}! ☀️
          </h2>
          <p className="text-[#6F7785] font-bold mt-1 text-[15px]">
            Let's make today a great financial day!
          </p>
        </div>

        {/* Header Icons */}
        <div className="flex items-center gap-3 pt-1">
          <button className="w-10 h-10 rounded-full border border-[#EFE2D8] bg-white flex items-center justify-center cursor-pointer hover:bg-[#FFF8F2] transition-colors shadow-[0_8px_18px_rgba(92,65,45,0.08)]">
            <Search size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
          <button className="w-10 h-10 rounded-full border border-[#EFE2D8] bg-white flex items-center justify-center cursor-pointer hover:bg-[#FFF8F2] transition-colors shadow-[0_8px_18px_rgba(92,65,45,0.08)]">
            <Bell size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
        </div>
      </div>

      {/* Main Grid Container with Mascot absolute header */}
      <div className="relative pt-4">
        {/* Hanging Cat Mascot */}
        <CuteSticker
          name="hanging-cat"
          className="absolute top-[-34px] right-8 w-[134px] h-[76px] z-10 pointer-events-none select-none drop-shadow-[0_10px_12px_rgba(92,65,45,0.12)]"
          title="Cute Hanging Cat Mascot"
        />

        {/* 4 Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 relative z-0">
          {/* Card 1: Balance */}
          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#EAFBF1]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Total Balance</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{`$${summary.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className="text-[11px] font-black text-[#55B978] bg-[#EAFBF1] rounded-full px-2 py-0.5">
                +12.5% vs last month
              </span>
              <CuteSticker name="sprout" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Sprout Icon" />
            </div>
          </Card>

          {/* Card 2: Income */}
          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#FFF4D6]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Income</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{`$${summary.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className="text-[11px] font-black text-[#55B978] bg-[#EAFBF1] rounded-full px-2 py-0.5">
                +8.1% vs last month
              </span>
              <CuteSticker name="money-bag" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Money Bag Icon" />
            </div>
          </Card>

          {/* Card 3: Expenses */}
          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#FFF0F2]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Expenses</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{`$${summary.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className="text-[11px] font-black text-[#F27C8B] bg-[#FFF0F2] rounded-full px-2 py-0.5">
                -5.3% vs last month
              </span>
              <CuteSticker name="shopping-bag" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Shopping Bag Icon" />
            </div>
          </Card>

          {/* Card 4: Savings */}
          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#FFEFF4]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Savings</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{`$${summary.savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className="text-[11px] font-black text-[#55B978] bg-[#EAFBF1] rounded-full px-2 py-0.5">
                +15.2% vs last month
              </span>
              <CuteSticker name="piggy-bank" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Piggy Bank Icon" />
            </div>
          </Card>
        </div>
      </div>

      {/* Middle Row: Spending Chart & Recent Transactions */}
      <div className="dashboard-wide-grid grid gap-4 items-stretch mt-1 flex-1 min-h-[360px] xl:min-h-[386px] min-[1900px]:min-h-[0]">
        {/* Left Column: Spending Overview Donut Chart */}
        <Card noPadding className="dashboard-chart-card border border-[#EFE2D8] rounded-[22px] p-6 shadow-[0_10px_28px_rgba(92,65,45,0.08)] flex flex-col bg-[#FFFDFB] min-h-[360px] min-[1900px]:min-h-0 h-full overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-[17px] font-black text-[#2F2925]">Spending Overview</h3>
            <span className="rounded-full bg-[#FFF2E7] px-3 py-1 text-[11px] font-black text-[#FF7F96]">
              Monthly
            </span>
          </div>

          <div className="mt-4 hidden min-[1900px]:grid grid-cols-3 gap-3">
            <div className="rounded-[18px] bg-[#FFF7EC] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-[#8B929C]">Weekly treats</p>
                <span className="text-sm">☕</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#2F2925]">$78.40</p>
            </div>
            <div className="rounded-[18px] bg-[#FFF7EC] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-[#8B929C]">Trips logged</p>
                <span className="text-sm">🚌</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#2F2925]">12</p>
            </div>
            <div className="rounded-[18px] bg-[#FFF7EC] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-[#8B929C]">Receipts tidy</p>
                <span className="text-sm">🧾</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#55B978]">94%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6 mt-3 flex-grow min-h-0">
            {/* Chart Area */}
            <div className="md:col-span-7 h-full min-h-[292px] min-[1900px]:min-h-[0] w-full relative flex items-center justify-center select-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="46%"
                    innerRadius="46%"
                    outerRadius="68%"
                    paddingAngle={2}
                    dataKey="amount"
                    stroke="#FFFDFB"
                    strokeWidth={3}
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={false}
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`$${value}`, 'Category Total']}
                    contentStyle={{
                      borderRadius: '15px',
                      border: '1px solid #EFE2D8',
                      fontFamily: 'Nunito, sans-serif',
                      fontWeight: 'bold',
                      color: '#4E3629'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Central Text inside Donut Hole */}
              <div className="absolute -translate-y-[10%] flex flex-col items-center justify-center text-center">
                <span className="text-[22px] min-[1900px]:text-[26px] font-black text-[#2F2925]">{`$${summary.expense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</span>
                <span className="text-[12px] min-[1900px]:text-[13px] text-[#8B929C] font-bold mt-0.5">This month</span>
              </div>
            </div>

            {/* Legend Details Area */}
            <div className="md:col-span-5 flex flex-col gap-2.5">
              {expenseData.map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-[14px] bg-[#FAF6F0] px-3 py-2.5 text-xs font-bold shadow-[inset_0_0_0_1px_rgba(92,65,45,0.04)]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="text-[#6F7785] font-extrabold truncate max-w-[128px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="text-[#8B929C] text-[11px] font-bold w-8">{item.percentage}%</span>
                    <span className="text-[#2F2925] font-black w-[66px]">{`$${item.amount.toFixed(2)}`}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 min-[1900px]:grid-cols-4 gap-3">
            <div className="rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Tracked categories</p>
              <p className="mt-1 text-lg font-black text-[#2F2925]">{expenseData.length}</p>
            </div>
            <div className="rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Largest share</p>
              <p className="mt-1 text-lg font-black text-[#2F2925]">{expenseData[0]?.percentage ?? 0}%</p>
            </div>
            <div className="hidden min-[1900px]:block rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Daily average</p>
              <p className="mt-1 text-lg font-black text-[#2F2925]">$60.67</p>
            </div>
            <div className="hidden min-[1900px]:block rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Budget left</p>
              <p className="mt-1 text-lg font-black text-[#55B978]">$840.80</p>
            </div>
          </div>
        </Card>

        {/* Right Column: Recent Transactions List */}
        <Card noPadding className="dashboard-transactions-card border border-[#EFE2D8] rounded-[22px] p-6 shadow-[0_10px_28px_rgba(92,65,45,0.08)] flex flex-col bg-[#FFFDFB] min-h-[360px] min-[1900px]:min-h-0 h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-black text-[#2F2925]">Recent Transactions</h3>
            <span className="text-xs font-black text-[#FF7F96] hover:underline cursor-pointer">See all</span>
          </div>

          <div className="flex flex-col gap-3 min-h-0">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-[#FAF6F0] px-3 py-2.5 text-sm shadow-[inset_0_0_0_1px_rgba(92,65,45,0.04)]">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Category icon circle container */}
                  <span className="w-9 h-9 rounded-full bg-[#F7EFE8] flex items-center justify-center text-lg shrink-0 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]">
                    {tx.icon}
                  </span>

                  <div className="min-w-0">
                    <p className="font-black text-[#2F2925] truncate text-[14px] leading-tight">{tx.description}</p>
                    <p className="text-[11px] text-[#8B929C] font-bold mt-0.5">{tx.date}</p>
                  </div>
                </div>

                <p className={`font-black text-[14px] whitespace-nowrap ${tx.type === 'income' ? 'text-[#55B978]' : 'text-[#2F2925]'}`}>
                  {`${tx.type === 'income' ? '+' : '-'}$${tx.amount.toFixed(2)}`}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden min-[1900px]:grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-[#FFF4E8] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#7B8491]">Income</span>
                <span className="text-sm">💵</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#55B978]">{`$${summary.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
            <div className="rounded-[18px] bg-[#FFF4E8] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#7B8491]">Expenses</span>
                <span className="text-sm">🛍️</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#F27C8B]">{`$${summary.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
          </div>

          <div className="mt-4 hidden min-[1900px]:block rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-[#2F2925]">October rhythm</p>
              <p className="text-[11px] font-black text-[#55B978]">62.7%</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[#EFE4DA] overflow-hidden">
              <div className="h-full w-[63%] rounded-full bg-[#7ACB9C]" />
            </div>
            <p className="mt-2 text-[11px] font-bold leading-snug text-[#7B8491]">
              Savings rate is ahead of the monthly target.
            </p>
          </div>
        </Card>

        {/* Wide Screen Helper Rail */}
        <Card noPadding className="dashboard-helper-card border border-[#EFE2D8] rounded-[22px] p-5 shadow-[0_10px_28px_rgba(92,65,45,0.08)] flex-col bg-[#FFFDFB] min-h-[360px] min-[1900px]:min-h-0 h-full overflow-hidden">
          <div className="rounded-[20px] bg-[#FFF4E8] border border-[#F0DFD0] px-4 py-4 text-center">
            <CuteSticker
              name="waving-cat"
              className="mx-auto mb-1.5 h-[88px] w-[96px] drop-shadow-[0_10px_16px_rgba(92,65,45,0.12)]"
              title="AI bookkeeping helper"
            />
            <h3 className="text-[17px] font-black text-[#2F2925]">Bookkeeping Buddy</h3>
            <p className="mt-1 text-[11px] font-bold leading-snug text-[#7B8491]">
              Ready to tidy up receipts and little spending notes.
            </p>
          </div>

          <div className="mt-3 grid gap-2.5">
            <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#7B8491]">Drafts waiting</span>
                <span className="rounded-full bg-[#FFD1DC] px-2 py-0.5 text-xs font-black text-[#4E3629]">{drafts.length}</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#2F2925]">{drafts.length === 0 ? 'All clear' : 'Needs review'}</p>
            </div>

            <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#7B8491]">Top category</span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF8C94]" />
              </div>
              <p className="mt-1.5 truncate text-lg font-black text-[#2F2925]">{expenseData[0]?.name || 'Food & Dining'}</p>
            </div>

            <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#7B8491]">Savings mood</span>
                <span className="text-xs font-black text-[#55B978]">+15.2%</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#2F2925]">{`$${summary.savings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
          </div>

          <div className="mt-3 rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3 text-center">
            <p className="text-sm font-black text-[#2F2925]">Quick entry is ready</p>
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#7B8491]">Use the bottom bar to add a note or scan a receipt.</p>
          </div>

          <div className="mt-3 rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
            <p className="text-xs font-black text-[#7B8491]">Tiny goals</p>
            <div className="mt-2 grid gap-2">
              <div>
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span>Snack budget</span>
                  <span className="text-[#55B978]">78%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EFE4DA]">
                  <div className="h-full w-[78%] rounded-full bg-[#FFB87A]" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span>Trip fund</span>
                  <span className="text-[#55B978]">41%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EFE4DA]">
                  <div className="h-full w-[41%] rounded-full bg-[#7ACB9C]" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Hidden File Input for Receipt Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Bottom Chat Bar with Waving Mascot */}
      <div className="mt-1 rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] px-5 py-4 shadow-[0_12px_32px_rgba(92,65,45,0.08)] flex items-center gap-4 select-none">
        {/* Waving Mascot illustration */}
        <div className="w-[78px] h-[66px] shrink-0 relative pointer-events-none select-none">
          <CuteSticker
            name="waving-cat"
            className="w-full h-full scale-110 drop-shadow-[0_8px_10px_rgba(92,65,45,0.1)]"
            title="Waving Cat Mascot"
          />
        </div>

        {/* Input Text box Container */}
        <div className="flex-grow relative flex items-center">
          <input
            id="ai-chat-input"
            type="text"
            placeholder='Try: "Lunch 38, Taxi 22" or upload a receipt'
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextAnalyze()}
            disabled={loading || uploading}
            className="w-full pl-6 pr-28 py-3.5 bg-[#FFF8F3] border border-[#EFE2D8] rounded-full focus:outline-none focus:ring-4 focus:ring-[#FFD1DC]/40 text-sm font-bold text-[#4E3629] placeholder-[#A7A0A0] shadow-inner transition-all"
          />

          {/* Quick Action buttons inside the bar */}
          <div className="absolute right-3 flex items-center gap-2">
            {/* Camera Upload Button */}
            <button
              onClick={triggerFileUpload}
              disabled={loading || uploading}
              className="p-1.5 text-gray-500 hover:text-[#4E3629] transition-colors cursor-pointer rounded-full hover:bg-gray-50 disabled:opacity-50"
              title="Upload Receipt Scanner"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#4E3629]"></div>
              ) : (
                <Camera size={20} strokeWidth={2.25} />
              )}
            </button>

            {/* Send Button */}
            <button
              onClick={handleTextAnalyze}
              disabled={loading || !textInput.trim()}
              className="w-9 h-9 bg-[#FF9BAB] hover:bg-[#FF7F96] text-white rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shadow-[0_8px_18px_rgba(255,127,150,0.28)]"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send size={14} className="transform translate-x-[-1px] translate-y-[1px]" strokeWidth={3} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cozy Sticker Drawer (Slide-up Overlay Drawer) */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-[#4E3629]/20 z-50 flex items-end justify-center backdrop-blur-xs transition-opacity">
          {/* Main Drawer Content */}
          <div className="w-full max-w-[1100px] bg-[#FAF8F5] border-t border-x border-[#EFE2D8] rounded-t-[32px] p-6 shadow-2xl animate-slide-up flex flex-col gap-5 max-h-[80vh] overflow-y-auto">

            {/* Header of Drawer */}
            <div className="flex items-center justify-between border-b border-[#4E3629]/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="text-lg font-black text-[#4E3629] flex items-center gap-2">
                    AI Parsed Drafts
                    <span className="bg-[#FFD1DC] text-[#4E3629] text-xs py-0.5 px-2 rounded-full font-black">
                      {drafts.length}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5">Please review and confirm transactions to save to ledger</p>
                </div>
              </div>

              {/* Top buttons inside Drawer header */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCommitAll}
                  className="px-5 py-2 bg-[#FFAE58] hover:bg-[#EAA050] text-white rounded-full font-black text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                >
                  Save All to Ledger ✨
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 border border-[#EFE2D8] rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* Sticky Notes Draft Board Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 py-4 overflow-y-auto flex-grow max-h-[50vh]">
              {drafts.map((draft, index) => {
                const bgClass = NOTE_BACKGROUNDS[index % NOTE_BACKGROUNDS.length];
                const isEditing = editingId === draft.id;

                return (
                  <div
                    key={draft.id}
                    className={`cute-sticky-card ${bgClass} border border-[#E2CFC2] rounded-[15px] p-5 shadow-[0_10px_24px_rgba(92,65,45,0.12)] transform transition-all select-none relative`}
                    style={{
                      transform: isEditing ? 'none' : `rotate(${index % 2 === 0 ? '2deg' : '-2deg'})`,
                      zIndex: isEditing ? 20 : 1
                    }}
                  >
                    {/* Visual Decorators */}
                    <Thumbtack />
                    <CurledCorner />

                    {isEditing ? (
                      <div className="flex flex-col gap-2.5 mt-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editForm.category || ''}
                            onChange={e => setEditForm({...editForm, category: e.target.value})}
                            className="text-xs font-black px-2 py-1 rounded-md border-2 border-[#4E3629] w-full bg-white text-[#4E3629]"
                            placeholder="Category"
                          />
                          <select
                            value={editForm.type || 'expense'}
                            onChange={e => setEditForm({...editForm, type: e.target.value as 'income'|'expense'})}
                            className="text-xs font-black px-2 py-1 rounded-md border-2 border-[#4E3629] w-full bg-white text-[#4E3629]"
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </div>

                        <textarea
                          value={editForm.description || ''}
                          onChange={e => setEditForm({...editForm, description: e.target.value})}
                          className="font-bold text-[#4E3629] text-xs w-full border-2 border-[#4E3629] rounded-md p-1.5 bg-white resize-none"
                          rows={2}
                          placeholder="Description"
                        />

                        <input
                          type="date"
                          value={editForm.date || ''}
                          onChange={e => setEditForm({...editForm, date: e.target.value})}
                          className="text-xs text-[#4E3629] font-bold border-2 border-[#4E3629] rounded-md p-1 w-full bg-white"
                        />

                        <div className="flex items-center gap-1 border-2 border-[#4E3629] rounded-md p-1 bg-white">
                          <span className="text-[#4E3629]/50 font-black pl-1">$</span>
                          <input
                            type="number"
                            value={editForm.amount || ''}
                            onChange={e => setEditForm({...editForm, amount: parseFloat(e.target.value) || 0})}
                            className="font-black text-sm text-[#4E3629] w-full outline-none bg-transparent"
                            step="0.01"
                          />
                        </div>

                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-500 hover:text-gray-700 bg-white/60 border-2 border-[#4E3629] rounded-full p-1 cursor-pointer"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                          <button
                            onClick={() => {
                              updateDraft(draft.id, editForm);
                              setEditingId(null);
                            }}
                            className="bg-emerald-400 hover:bg-emerald-500 text-white border-2 border-[#4E3629] p-1 rounded-full cursor-pointer transition-colors"
                            title="Save"
                          >
                            <Save size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-between h-full min-h-[140px] pr-2 pt-2">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-white/70 border-2 border-[#4E3629] px-2 py-0.5 rounded-full">
                              {draft.category}
                            </span>
                            <div className="flex gap-1.5 z-10">
                              <button
                                onClick={() => {
                                  setEditingId(draft.id);
                                  setEditForm(draft);
                                }}
                                className="text-[#4E3629] hover:text-blue-600 bg-white/50 border-2 border-[#4E3629] p-1 rounded-md cursor-pointer transition-colors"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={() => removeDraft(draft.id)}
                                className="text-[#4E3629] hover:text-red-500 bg-white/50 border-2 border-[#4E3629] p-1 rounded-md cursor-pointer transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          <h3 className="font-bold text-sm text-[#4E3629] mt-3 line-clamp-2 leading-tight">
                            {draft.description}
                          </h3>
                        </div>

                        <div className="flex justify-between items-end mt-4">
                          <div>
                            <p className="text-[10px] text-[#4E3629]/60 font-bold">{draft.date}</p>
                            <p className="font-black text-lg mt-0.5">${draft.amount.toFixed(2)}</p>
                          </div>

                          <button
                            onClick={() => handleCommitDraft(draft.id)}
                            className="w-8 h-8 bg-white border-2 border-[#4E3629] rounded-full flex items-center justify-center text-pink-500 shadow-sm hover:bg-pink-500 hover:text-white cursor-pointer transition-all group"
                            title="Confirm Draft"
                          >
                            <PawPrint size={14} className="group-hover:scale-110 transition-transform text-[#4E3629] hover:text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
