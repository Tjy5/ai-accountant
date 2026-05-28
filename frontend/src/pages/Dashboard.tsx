import { useEffect, useState, useRef } from 'react';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { CurledCorner, Thumbtack } from '../components/DraftNoteChrome';
import { NOTE_BACKGROUNDS } from '../constants/draftStyles';
import { useAuthStore } from '../store/useAuthStore';
import { useDraftStore } from '../store/useDraftStore';
import type { DraftTransaction } from '../store/useDraftStore';
import api from '../api/axiosInstance';
import { analyzeImageDrafts, analyzeTextDrafts, commitDrafts, readFileAsDataUrl } from '../api/aiDrafts';
import { money } from '../utils/formatters';
import { asRecord, asRecordArray, toNumber, type RawRecord } from '../utils/records';
import { userLabel } from '../utils/profile';
import { Link } from 'react-router-dom';
import type { AiDraftResponse } from '../types/ai';
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
  transactionCount: number;
}

interface ChartData {
  name: string;
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

const DEFAULT_SUMMARY: SummaryData = {
  balance: 0,
  income: 0,
  expense: 0,
  savings: 0,
  transactionCount: 0,
};

const DONUT_COLORS = ['#FF8C94', '#64B5F6', '#FFD54F', '#BA68C8', '#A1887F'];

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

const normalizeSummary = (raw: unknown): SummaryData => {
  const totals = asRecord(asRecord(raw).totals);
  const balance = toNumber(totals.net);
  return {
    balance,
    income: toNumber(totals.income),
    expense: toNumber(totals.expense),
    savings: toNumber(totals.savings, Math.max(balance, 0)),
    transactionCount: toNumber(totals.count),
  };
};

const normalizeRecentTransaction = (raw: RawRecord, index: number): TransactionData => {
  const type = raw.type === 'income' ? 'income' : 'expense';
  const mapped = {
    id: String(raw.id ?? index),
    type,
    category: String(raw.category || 'Other'),
    amount: toNumber(raw.amount),
    description: String(raw.description || raw.category || 'Transaction'),
    date: formatTransactionDate(typeof raw.date === 'string' ? raw.date : undefined),
    icon: '',
  };
  return { ...mapped, icon: iconForTransaction(mapped) };
};

const normalizeRecentTransactions = (raw: unknown) =>
  asRecordArray(asRecord(raw).recentTransactions).slice(0, 5).map(normalizeRecentTransaction);

const normalizeExpenseData = (raw: unknown): ChartData[] => {
  const rows = asRecordArray(asRecord(raw).categoryShare).slice(0, 5);
  const total = rows.reduce((sum, row) => sum + toNumber(row.total), 0);

  return rows.map((row, index) => {
    const amount = toNumber(row.total);
    return {
      name: String(row.category || 'Other'),
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      amount,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
    };
  });
};

const FINANCIAL_TIPS = [
  "💡 Tip: Tracking small expenses like coffee can save you up to $150 a month!",
  "💡 Tip: Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.",
  "💡 Tip: Review your subscriptions regularly to cancel services you no longer use.",
  "💡 Tip: Building a 3-to-6 month emergency fund provides critical financial peace of mind.",
  "💡 Tip: Set realistic budgets by categories instead of one general limit.",
  "💡 Tip: Pay yourself first by setting aside savings immediately when income arrives."
];

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const { drafts, addDrafts, updateDraft, removeDraft, clearDrafts } = useDraftStore();
  const displayName = userLabel(user, 'there');

  const [summary, setSummary] = useState<SummaryData>(DEFAULT_SUMMARY);
  const [expenseData, setExpenseData] = useState<ChartData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionData[]>([]);

  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftDrawerDismissed, setDraftDrawerDismissed] = useState(false);
  const [draftError, setDraftError] = useState('');
  const drawerOpen = drafts.length > 0 && !draftDrawerDismissed;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DraftTransaction>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [summaryRes, chartsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/charts')
        ]);

        const recent = normalizeRecentTransactions(summaryRes.data);
        const chartRows = normalizeExpenseData(chartsRes.data);

        setSummary(normalizeSummary(summaryRes.data));
        setRecentTransactions(recent);
        setExpenseData(chartRows);
      } catch {
        return;
      }
    };

    fetchDashboardData();
  }, []);

  const errorMessage = (error: unknown, fallback: string) => {
    const maybe = error as { response?: { data?: { error?: string } } };
    return maybe.response?.data?.error || fallback;
  };

  const applyAiResponse = (response: AiDraftResponse) => {
    const nextDrafts = response.drafts || [];
    if (nextDrafts.length > 0) {
      addDrafts(nextDrafts);
      setDraftDrawerDismissed(false);
    }
  };

  const handleAnalyzeText = async (text: string) => {
    if (!text.trim()) return;

    setDraftError('');
    setLoading(true);
    try {
      applyAiResponse(await analyzeTextDrafts(text));
    } catch (error) {
      setDraftError(errorMessage(error, 'Unable to analyze this entry. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleTextAnalyze = async () => {
    const text = textInput.trim();
    if (!text) return;
    await handleAnalyzeText(text);
    setTextInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setDraftError('');
    setUploading(true);
    try {
      const image = await readFileAsDataUrl(file);
      applyAiResponse(await analyzeImageDrafts(image, { filename: file.name }));
    } catch (error) {
      setDraftError(errorMessage(error, 'Unable to scan this receipt. Please try again.'));
    } finally {
      input.value = '';
      setUploading(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCommitDraft = async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;

    setDraftError('');
    try {
      await commitDrafts([draft]);
      removeDraft(draftId);
    } catch {
      setDraftError('Unable to save this draft. It is still here for retry.');
    }
  };

  const handleCommitAll = async () => {
    if (drafts.length === 0) return;

    setDraftError('');
    try {
      await commitDrafts(drafts);
      clearDrafts();
    } catch {
      setDraftError('Unable to save drafts. Nothing was removed.');
    }
  };

  const savingsRate = summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : 0;
  const topCategory = expenseData[0];
  const largestShare = topCategory?.percentage ?? 0;
  const flowTotal = summary.income + summary.expense;
  const incomeShare = flowTotal > 0 ? Math.round((summary.income / flowTotal) * 100) : 0;
  const expenseShare = flowTotal > 0 ? 100 - incomeShare : 0;
  const averageEntry = summary.transactionCount > 0 ? flowTotal / summary.transactionCount : 0;
  const entryLabel = `${summary.transactionCount} ${summary.transactionCount === 1 ? 'entry' : 'entries'} this month`;
  const financialTip = FINANCIAL_TIPS[new Date().getDate() % FINANCIAL_TIPS.length];

  return (
    <div className="dashboard-page flex flex-col gap-4 relative flex-grow min-h-0">
      <div className="flex flex-col gap-4 min-[1120px]:flex-row min-[1120px]:items-start min-[1120px]:justify-between">
        <div>
          <h2 className="text-[32px] leading-tight font-black text-[#2F2925] tracking-tight">
            Good morning, {displayName}! ☀️
          </h2>
          <p className="text-[#6F7785] font-bold mt-1 text-[15px]">
            Let's make today a great financial day!
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            aria-label="Search"
            className="w-10 h-10 rounded-full border border-[#EFE2D8] bg-white flex items-center justify-center cursor-pointer hover:bg-[#FFF8F2] transition-colors shadow-[0_8px_18px_rgba(92,65,45,0.08)]"
          >
            <Search size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
          <button
            aria-label="Notifications"
            className="w-10 h-10 rounded-full border border-[#EFE2D8] bg-white flex items-center justify-center cursor-pointer hover:bg-[#FFF8F2] transition-colors shadow-[0_8px_18px_rgba(92,65,45,0.08)]"
          >
            <Bell size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
        </div>
      </div>

      <div className="relative pt-4">
        <CuteSticker
          name="hanging-cat"
          className="absolute top-[-34px] right-8 w-[134px] h-[76px] z-10 pointer-events-none select-none drop-shadow-[0_10px_12px_rgba(92,65,45,0.12)]"
          title="Cute Hanging Cat Mascot"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 relative z-0">
          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#EAFBF1]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Total Balance</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{money.format(summary.balance)}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className={`text-[11px] font-black rounded-full px-2 py-0.5 ${summary.balance >= 0 ? 'bg-[#EAFBF1] text-[#55B978]' : 'bg-[#FFF0F2] text-[#F27C8B]'}`}>
                {summary.balance >= 0 ? 'Positive net flow' : 'Negative net flow'}
              </span>
              <CuteSticker name="sprout" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Sprout Icon" />
            </div>
          </Card>

          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#FFF4D6]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Income</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{money.format(summary.income)}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className="text-[11px] font-black text-[#55B978] bg-[#EAFBF1] rounded-full px-2 py-0.5">
                {summary.income > 0 ? 'Income recorded' : 'No income yet'}
              </span>
              <CuteSticker name="money-bag" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Money Bag Icon" />
            </div>
          </Card>

          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#FFF0F2]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Expenses</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{money.format(summary.expense)}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className="text-[11px] font-black text-[#F27C8B] bg-[#FFF0F2] rounded-full px-2 py-0.5">
                {summary.expense > 0 ? 'Spending recorded' : 'No expenses yet'}
              </span>
              <CuteSticker name="shopping-bag" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Shopping Bag Icon" />
            </div>
          </Card>

          <Card noPadding className="bg-[#FFFDFB] border border-[#EFE2D8] rounded-[22px] p-5 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -right-7 -bottom-8 w-[118px] h-[118px] rounded-full bg-[#FFEFF4]" />
            <div className="relative z-[1]">
              <h3 className="text-[13px] font-extrabold text-[#3D3028]">Savings</h3>
              <p className="text-[24px] leading-tight font-black text-[#2F2925] mt-3">{money.format(summary.savings)}</p>
            </div>
            <div className="relative z-[1] flex justify-between items-end mt-2">
              <span className={`text-[11px] font-black rounded-full px-2 py-0.5 ${summary.savings >= 0 ? 'bg-[#EAFBF1] text-[#55B978]' : 'bg-[#FFF0F2] text-[#F27C8B]'}`}>
                {summary.income > 0 ? `${savingsRate}% savings rate` : 'No income yet'}
              </span>
              <CuteSticker name="piggy-bank" className="w-[58px] h-[58px] absolute bottom-[-10px] right-[-4px]" title="Piggy Bank Icon" />
            </div>
          </Card>
        </div>
      </div>

      <div className="dashboard-wide-grid grid gap-4 items-stretch mt-1 flex-1 min-h-[360px] xl:min-h-[386px] min-[1900px]:min-h-[0]">
        <Card noPadding className="dashboard-chart-card border border-[#EFE2D8] rounded-[22px] p-6 shadow-[0_10px_28px_rgba(92,65,45,0.08)] flex flex-col bg-[#FFFDFB] min-h-[360px] overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-[17px] font-black text-[#2F2925]">Spending Overview</h3>
            <span className="rounded-full bg-[#FFF2E7] px-3 py-1 text-[11px] font-black text-[#FF7F96]">
              Monthly
            </span>
          </div>

          <div className="mt-4 hidden min-[1900px]:grid grid-cols-3 gap-3">
            <div className="rounded-[18px] bg-[#FFF7EC] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-[#8B929C]">Entries tracked</p>
                <span className="text-sm">🧾</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#2F2925]">{summary.transactionCount}</p>
            </div>
            <div className="rounded-[18px] bg-[#FFF7EC] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-[#8B929C]">Top category</p>
                <span className="text-sm">📌</span>
              </div>
              <p className="mt-1 truncate text-lg font-black text-[#2F2925]">{topCategory?.name || 'None'}</p>
            </div>
            <div className="rounded-[18px] bg-[#FFF7EC] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black text-[#8B929C]">Savings rate</p>
                <span className="text-sm">💵</span>
              </div>
              <p className={`mt-1 text-lg font-black ${summary.savings >= 0 ? 'text-[#55B978]' : 'text-[#F27C8B]'}`}>{savingsRate}%</p>
            </div>
          </div>

          {expenseData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6 mt-3 flex-grow min-h-0">
              <div className="md:col-span-7 h-full min-h-[260px] w-full relative flex items-center justify-center select-none">
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
                      formatter={(value) => [money.format(toNumber(value)), 'Category Total']}
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

                <div className="absolute -translate-y-[10%] flex flex-col items-center justify-center text-center">
                  <span className="text-[22px] min-[1900px]:text-[26px] font-black text-[#2F2925]">{money.format(summary.expense)}</span>
                  <span className="text-[12px] min-[1900px]:text-[13px] text-[#8B929C] font-bold mt-0.5">This month</span>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col gap-2.5">
                {expenseData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between rounded-[14px] bg-[#FAF6F0] px-3 py-2.5 text-xs font-bold shadow-[inset_0_0_0_1px_rgba(92,65,45,0.04)]">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="text-[#6F7785] font-extrabold truncate max-w-[128px]">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-[#8B929C] text-[11px] font-bold w-8">{item.percentage}%</span>
                      <span className="text-[#2F2925] font-black w-[66px]">{money.format(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex-grow flex flex-col items-center justify-center min-h-[220px] w-full rounded-[20px] bg-[#FFF8F2] p-6 text-center border border-[#F0DFD0]">
              <CuteSticker name="categories-cat" className="h-[96px] w-[96px] mb-2 drop-shadow-[0_8px_16px_rgba(92,65,45,0.1)]" title="No expense categories yet" />
              <div>
                <p className="text-[16px] font-black text-[#2F2925]">No expense categories yet</p>
                <p className="mt-1 max-w-[260px] text-[12px] font-bold leading-relaxed text-[#8B929C] mx-auto">
                  Add or confirm expenses to build the spending overview.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 min-[1900px]:grid-cols-4 gap-3">
            <div className="rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Tracked categories</p>
              <p className="mt-1 text-lg font-black text-[#2F2925]">{expenseData.length}</p>
            </div>
            <div className="rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Largest share</p>
              <p className="mt-1 text-lg font-black text-[#2F2925]">{largestShare}%</p>
            </div>
            <div className="hidden min-[1900px]:block rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Average entry</p>
              <p className="mt-1 text-lg font-black text-[#2F2925]">{money.format(averageEntry)}</p>
            </div>
            <div className="hidden min-[1900px]:block rounded-[16px] bg-[#FFF8F2] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <p className="text-[11px] font-black text-[#8B929C]">Net flow</p>
              <p className={`mt-1 text-lg font-black ${summary.balance >= 0 ? 'text-[#55B978]' : 'text-[#F27C8B]'}`}>{money.format(summary.balance)}</p>
            </div>
          </div>
        </Card>

        <Card noPadding className="dashboard-transactions-card border border-[#EFE2D8] rounded-[22px] p-6 shadow-[0_10px_28px_rgba(92,65,45,0.08)] flex flex-col bg-[#FFFDFB] min-h-[360px] overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-black text-[#2F2925]">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs font-black text-[#FF7F96] hover:underline">See all</Link>
          </div>

          <div className="flex flex-col gap-3 min-h-0 flex-grow">
            {recentTransactions.length === 0 ? (
              <div className="rounded-[18px] bg-[#FFF8F2] border border-[#F0DFD0] px-4 py-8 text-center flex-grow flex flex-col items-center justify-center min-h-[140px] gap-2">
                <CuteSticker name="transactions-cat" className="h-[96px] w-[96px] mb-1 drop-shadow-[0_8px_16px_rgba(92,65,45,0.1)]" title="No recent transactions" />
                <div>
                  <p className="text-sm font-black text-[#2F2925]">No recent transactions</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8B929C]">{entryLabel}</p>
                </div>
              </div>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-[#FAF6F0] px-3 py-2.5 text-sm shadow-[inset_0_0_0_1px_rgba(92,65,45,0.04)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-[#F7EFE8] flex items-center justify-center text-lg shrink-0 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]">
                      {tx.icon}
                    </span>

                    <div className="min-w-0">
                      <p className="font-black text-[#2F2925] truncate text-[14px] leading-tight">{tx.description}</p>
                      <p className="text-[11px] text-[#8B929C] font-bold mt-0.5">{tx.date}</p>
                    </div>
                  </div>

                  <p className={`font-black text-[14px] whitespace-nowrap ${tx.type === 'income' ? 'text-[#55B978]' : 'text-[#2F2925]'}`}>
                    {`${tx.type === 'income' ? '+' : '-'}${money.format(tx.amount)}`}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 hidden min-[1900px]:grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-[#FFF4E8] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#7B8491]">Income</span>
                <span className="text-sm">💵</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#55B978]">{money.format(summary.income)}</p>
            </div>
            <div className="rounded-[18px] bg-[#FFF4E8] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#7B8491]">Expenses</span>
                <span className="text-sm">🛍️</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#F27C8B]">{money.format(summary.expense)}</p>
            </div>
          </div>

          <div className="mt-4 hidden min-[1900px]:block rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-[#2F2925]">Savings rate</p>
              <p className={`text-[11px] font-black ${summary.savings >= 0 ? 'text-[#55B978]' : 'text-[#F27C8B]'}`}>{savingsRate}%</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[#EFE4DA] overflow-hidden">
              <div
                className={`h-full rounded-full ${summary.savings >= 0 ? 'bg-[#7ACB9C]' : 'bg-[#F27C8B]'}`}
                style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-bold leading-snug text-[#7B8491]">
              {summary.income > 0 ? 'Net saved from recorded income.' : 'Add income to track savings rate.'}
            </p>
          </div>

          <div className="mt-4 hidden min-[1900px]:block rounded-[18px] border border-[#F0DFD0] bg-[#FFFDFB] px-4 py-3.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.02)]">
            <h4 className="text-xs font-black text-[#2F2925] mb-2 flex items-center gap-1.5">
              <span>⚡</span> Quick Log Shortcuts
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAnalyzeText("Coffee 5")}
                disabled={loading || uploading}
                className="flex items-center justify-between rounded-xl bg-[#FFF8F2] hover:bg-[#FFF2E7] border border-[#EFE2D8] px-3 py-2 text-xs font-bold text-[#4E3629] transition-all cursor-pointer disabled:opacity-50"
              >
                <span>☕ Coffee</span>
                <span className="font-black text-[#FF7F96]">$5</span>
              </button>
              <button
                onClick={() => handleAnalyzeText("Lunch 15")}
                disabled={loading || uploading}
                className="flex items-center justify-between rounded-xl bg-[#FFF8F2] hover:bg-[#FFF2E7] border border-[#EFE2D8] px-3 py-2 text-xs font-bold text-[#4E3629] transition-all cursor-pointer disabled:opacity-50"
              >
                <span>🍔 Lunch</span>
                <span className="font-black text-[#FF7F96]">$15</span>
              </button>
              <button
                onClick={() => handleAnalyzeText("Subway 3")}
                disabled={loading || uploading}
                className="flex items-center justify-between rounded-xl bg-[#FFF8F2] hover:bg-[#FFF2E7] border border-[#EFE2D8] px-3 py-2 text-xs font-bold text-[#4E3629] transition-all cursor-pointer disabled:opacity-50"
              >
                <span>🚇 Subway</span>
                <span className="font-black text-[#FF7F96]">$3</span>
              </button>
              <button
                onClick={() => handleAnalyzeText("Shopping 50")}
                disabled={loading || uploading}
                className="flex items-center justify-between rounded-xl bg-[#FFF8F2] hover:bg-[#FFF2E7] border border-[#EFE2D8] px-3 py-2 text-xs font-bold text-[#4E3629] transition-all cursor-pointer disabled:opacity-50"
              >
                <span>🛍️ Shopping</span>
                <span className="font-black text-[#FF7F96]">$50</span>
              </button>
            </div>
          </div>

          <div className="mt-4 hidden min-[1900px]:block rounded-[18px] bg-[#FAF6F0] border border-[#EFE2D8] px-4 py-3 text-[11px] font-bold text-[#6F7785] leading-relaxed shadow-[inset_0_0_0_1px_rgba(92,65,45,0.03)]">
            {financialTip}
          </div>
        </Card>

        <Card noPadding className="dashboard-helper-card border border-[#EFE2D8] rounded-[22px] p-5 shadow-[0_10px_28px_rgba(92,65,45,0.08)] flex flex-col bg-[#FFFDFB] min-h-[360px] overflow-hidden">
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
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: topCategory?.color || '#EFE4DA' }} />
              </div>
              <p className="mt-1.5 truncate text-lg font-black text-[#2F2925]">{topCategory?.name || 'No expense data'}</p>
            </div>

            <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#7B8491]">Savings rate</span>
                <span className={`text-xs font-black ${summary.savings >= 0 ? 'text-[#55B978]' : 'text-[#F27C8B]'}`}>{savingsRate}%</span>
              </div>
              <p className="mt-1.5 text-lg font-black text-[#2F2925]">{money.format(summary.savings)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3 text-center">
            <p className="text-sm font-black text-[#2F2925]">Quick entry is ready</p>
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#7B8491]">Use the bottom bar to add a note or scan a receipt.</p>
          </div>

          <div className="mt-3 rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
            <p className="text-xs font-black text-[#7B8491]">Monthly mix</p>
            <div className="mt-2 grid gap-2">
              <div>
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span>Income</span>
                  <span className="text-[#55B978]">{money.format(summary.income)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EFE4DA]">
                  <div className="h-full rounded-full bg-[#7ACB9C]" style={{ width: `${incomeShare}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span>Expenses</span>
                  <span className="text-[#F27C8B]">{money.format(summary.expense)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EFE4DA]">
                  <div className="h-full rounded-full bg-[#FF8C94]" style={{ width: `${expenseShare}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {draftError && (
        <div className="rounded-[18px] border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600" role="alert">
          {draftError}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="mt-1 rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] px-5 py-4 shadow-[0_12px_32px_rgba(92,65,45,0.08)] flex items-center gap-4 select-none">
        <div className="w-[78px] h-[66px] shrink-0 relative pointer-events-none select-none">
          <CuteSticker
            name="waving-cat"
            className="w-full h-full scale-110 drop-shadow-[0_8px_10px_rgba(92,65,45,0.1)]"
            title="Waving Cat Mascot"
          />
        </div>

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

          <div className="absolute right-3 flex items-center gap-2">
            <button
              onClick={triggerFileUpload}
              disabled={loading || uploading}
              aria-label="Upload receipt"
              className="p-1.5 text-gray-500 hover:text-[#4E3629] transition-colors cursor-pointer rounded-full hover:bg-gray-50 disabled:opacity-50"
              title="Upload Receipt Scanner"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#4E3629]"></div>
              ) : (
                <Camera size={20} strokeWidth={2.25} />
              )}
            </button>

            <button
              onClick={handleTextAnalyze}
              disabled={loading || !textInput.trim()}
              aria-label="Analyze"
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

      {drawerOpen && (
        <div className="fixed inset-0 bg-[#4E3629]/20 z-50 flex items-end justify-center backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-[1100px] bg-[#FAF8F5] border-t border-x border-[#EFE2D8] rounded-t-[32px] p-6 shadow-2xl animate-slide-up flex flex-col gap-5 max-h-[80vh] overflow-y-auto">

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

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCommitAll}
                  className="px-5 py-2 bg-[#FFAE58] hover:bg-[#EAA050] text-white rounded-full font-black text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                >
                  Save All to Ledger ✨
                </button>
                <button
                  onClick={() => setDraftDrawerDismissed(true)}
                  aria-label="Close drafts"
                  className="p-1.5 border border-[#EFE2D8] rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
            </div>

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

                        <input
                          type="text"
                          value={editForm.currency ?? ''}
                          onChange={e => setEditForm({...editForm, currency: e.target.value.toUpperCase()})}
                          className="text-xs text-[#4E3629] font-bold border-2 border-[#4E3629] rounded-md p-1 w-full bg-white"
                          placeholder="Currency"
                          maxLength={8}
                        />

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
                            <p className="font-black text-lg mt-0.5">
                              {draft.currency ? `${draft.currency} ${draft.amount.toFixed(2)}` : money.format(draft.amount)}
                            </p>
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
