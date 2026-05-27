import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileBarChart,
  LoaderCircle,
  PieChart as PieChartIcon,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';

interface ReportRange {
  startDate: string;
  endDate: string;
  budgetMonth: string;
}

interface ReportSummary {
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  expenseCount: number;
  averageExpense: number;
  largestExpense: number;
  savingsRate: number;
}

interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
  transactionCount: number;
  averageAmount: number;
}

type BudgetStatus = 'on_track' | 'watch' | 'over';

interface BudgetReportRow {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  progress: number;
  status: BudgetStatus;
  color: string;
  icon: string;
}

interface BudgetHealth {
  month: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  progress: number;
  count: number;
  overBudget: number;
  watch: number;
  onTrack: number;
  categories: BudgetReportRow[];
}

interface LargeExpense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}

interface ReportInsight {
  title: string;
  body: string;
  tone: 'good' | 'warning' | 'focus' | 'neutral';
}

interface ReportData {
  range: ReportRange;
  summary: ReportSummary;
  monthlyTrend: MonthlyTrend[];
  categoryBreakdown: CategoryBreakdown[];
  budgetHealth: BudgetHealth;
  largeExpenses: LargeExpense[];
  insights: ReportInsight[];
  updatedAt?: string | null;
}

type PresetKey = '3m' | '6m' | 'ytd';
type RawRecord = Record<string, unknown>;

const CHART_COLORS = ['#FF8C94', '#64B5F6', '#FFD54F', '#BA68C8', '#7ACB9C', '#FFB87A', '#8C9EFF', '#4DB6AC'];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const currentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const defaultStartDate = () => {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
};

const defaultEndDate = () => {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

const toNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null;

const asRecord = (value: unknown): RawRecord => (isRecord(value) ? value : {});

const asRecordArray = (value: unknown): RawRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const readableMonth = (month: string) => {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const shortMonth = (month: string) => {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
  });
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const monthsBetween = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [currentMonthInput()];
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && out.length < 18) {
    out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
};

const normalizeSummary = (raw: unknown): ReportSummary => {
  const data = asRecord(raw);
  return {
    income: toNumber(data.income),
    expense: toNumber(data.expense),
    net: toNumber(data.net),
    transactionCount: toNumber(data.transactionCount ?? data.transaction_count),
    expenseCount: toNumber(data.expenseCount ?? data.expense_count),
    averageExpense: toNumber(data.averageExpense ?? data.average_expense),
    largestExpense: toNumber(data.largestExpense ?? data.largest_expense),
    savingsRate: toNumber(data.savingsRate ?? data.savings_rate),
  };
};

const normalizeReport = (raw: unknown, fallbackRange: ReportRange): ReportData => {
  const data = asRecord(raw);
  const range = asRecord(data.range);
  const budgetHealth = asRecord(data.budgetHealth ?? data.budget_health);
  const updatedAt = data.updatedAt ?? data.updated_at;

  return {
    range: {
      startDate: String(range.startDate ?? range.start_date ?? fallbackRange.startDate),
      endDate: String(range.endDate ?? range.end_date ?? fallbackRange.endDate),
      budgetMonth: String(range.budgetMonth ?? range.budget_month ?? fallbackRange.budgetMonth),
    },
    summary: normalizeSummary(data.summary),
    monthlyTrend: asRecordArray(data.monthlyTrend ?? data.monthly_trend).map((item) => ({
      month: String(item.month ?? ''),
      income: toNumber(item.income),
      expense: toNumber(item.expense),
      net: toNumber(item.net),
      count: toNumber(item.count),
    })),
    categoryBreakdown: asRecordArray(data.categoryBreakdown ?? data.category_breakdown).map((item) => ({
      category: String(item.category ?? 'Other'),
      total: toNumber(item.total),
      percentage: toNumber(item.percentage),
      transactionCount: toNumber(item.transactionCount ?? item.transaction_count),
      averageAmount: toNumber(item.averageAmount ?? item.average_amount),
    })),
    budgetHealth: {
      month: String(budgetHealth.month ?? fallbackRange.budgetMonth),
      totalBudget: toNumber(budgetHealth.totalBudget ?? budgetHealth.total_budget),
      totalSpent: toNumber(budgetHealth.totalSpent ?? budgetHealth.total_spent),
      remaining: toNumber(budgetHealth.remaining),
      progress: toNumber(budgetHealth.progress),
      count: toNumber(budgetHealth.count),
      overBudget: toNumber(budgetHealth.overBudget ?? budgetHealth.over_budget),
      watch: toNumber(budgetHealth.watch),
      onTrack: toNumber(budgetHealth.onTrack ?? budgetHealth.on_track),
      categories: asRecordArray(budgetHealth.categories).map((item, index) => ({
        id: String(item.id ?? `budget-${index}`),
        category: String(item.category ?? 'Other'),
        amount: toNumber(item.amount),
        spent: toNumber(item.spent),
        remaining: toNumber(item.remaining),
        progress: toNumber(item.progress),
        status: item.status === 'over' || item.status === 'watch' ? item.status : 'on_track',
        color: String(item.color ?? CHART_COLORS[index % CHART_COLORS.length]),
        icon: String(item.icon ?? 'tag'),
      })),
    },
    largeExpenses: asRecordArray(data.largeExpenses ?? data.large_expenses).map((item, index) => ({
      id: String(item.id ?? `expense-${index}`),
      category: String(item.category ?? 'Other'),
      amount: toNumber(item.amount),
      description: String(item.description ?? item.memo ?? 'Expense'),
      date: String(item.date ?? ''),
    })),
    insights: asRecordArray(data.insights).map((item) => ({
      title: String(item.title ?? 'Insight'),
      body: String(item.body ?? ''),
      tone: item.tone === 'good' || item.tone === 'warning' || item.tone === 'focus' ? item.tone : 'neutral',
    })),
    updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
  };
};

const sampleReport = (range: ReportRange): ReportData => {
  const months = monthsBetween(range.startDate, range.endDate);
  const monthlyTrend = months.map((month, index) => {
    const income = 4800 + index * 180;
    const expense = 1820 + (index % 3) * 220 + index * 48;
    return {
      month,
      income,
      expense,
      net: income - expense,
      count: 12 + index * 2,
    };
  });
  const income = monthlyTrend.reduce((sum, item) => sum + item.income, 0);
  const expense = monthlyTrend.reduce((sum, item) => sum + item.expense, 0);
  const categoryBreakdown = [
    { category: 'Food & Dining', total: 1280, percentage: 31, transactionCount: 18, averageAmount: 71.11 },
    { category: 'Shopping', total: 890, percentage: 22, transactionCount: 9, averageAmount: 98.89 },
    { category: 'Transport', total: 620, percentage: 15, transactionCount: 14, averageAmount: 44.29 },
    { category: 'Bills & Utilities', total: 540, percentage: 13, transactionCount: 5, averageAmount: 108 },
    { category: 'Entertainment', total: 420, percentage: 10, transactionCount: 7, averageAmount: 60 },
  ];

  return {
    range,
    summary: {
      income,
      expense,
      net: income - expense,
      transactionCount: monthlyTrend.reduce((sum, item) => sum + item.count, 0),
      expenseCount: 53,
      averageExpense: 77.17,
      largestExpense: 286.4,
      savingsRate: Math.round(((income - expense) / income) * 100),
    },
    monthlyTrend,
    categoryBreakdown,
    budgetHealth: {
      month: range.budgetMonth,
      totalBudget: 3260,
      totalSpent: 2748.4,
      remaining: 511.6,
      progress: 84,
      count: 5,
      overBudget: 1,
      watch: 2,
      onTrack: 2,
      categories: [
        { id: 'sample-food', category: 'Food & Dining', amount: 700, spent: 744.2, remaining: -44.2, progress: 106, status: 'over', color: '#FF8C94', icon: 'utensils' },
        { id: 'sample-shopping', category: 'Shopping', amount: 900, spent: 758.3, remaining: 141.7, progress: 84, status: 'watch', color: '#FFD54F', icon: 'shopping-bag' },
        { id: 'sample-transport', category: 'Transport', amount: 420, spent: 340.5, remaining: 79.5, progress: 81, status: 'watch', color: '#64B5F6', icon: 'bus' },
        { id: 'sample-bills', category: 'Bills & Utilities', amount: 720, spent: 562, remaining: 158, progress: 78, status: 'on_track', color: '#4DB6AC', icon: 'receipt' },
      ],
    },
    largeExpenses: [
      { id: 'sample-1', category: 'Shopping', amount: 286.4, description: 'Workspace chair', date: `${range.budgetMonth}-12T00:00:00` },
      { id: 'sample-2', category: 'Food & Dining', amount: 164.2, description: 'Weekend groceries', date: `${range.budgetMonth}-08T00:00:00` },
      { id: 'sample-3', category: 'Bills & Utilities', amount: 128.8, description: 'Internet and phone', date: `${range.budgetMonth}-03T00:00:00` },
    ],
    insights: [
      { title: 'Top spending lane', body: 'Food & Dining leads this report at 31% of expenses.', tone: 'focus' },
      { title: 'Budget attention', body: `1 budget line needs attention for ${range.budgetMonth}.`, tone: 'warning' },
      { title: 'Healthy savings rate', body: 'This range keeps savings comfortably above target.', tone: 'good' },
    ],
  };
};

const statusLabel = (status: BudgetStatus) => {
  if (status === 'over') return 'Over';
  if (status === 'watch') return 'Watch';
  return 'On track';
};

const statusColor = (status: BudgetStatus) => {
  if (status === 'over') return '#C44B61';
  if (status === 'watch') return '#B66B12';
  return '#168B5E';
};

const insightToneClass = (tone: ReportInsight['tone']) => {
  if (tone === 'warning') return 'border-[#F8C7CE] bg-[#FFF0F2] text-[#C44B61]';
  if (tone === 'good') return 'border-[#CBEAD7] bg-[#F4FBF6] text-[#168B5E]';
  if (tone === 'focus') return 'border-[#FFE1A6] bg-[#FFF9E7] text-[#9D6A00]';
  return 'border-[#EFE2D8] bg-[#FFFDFB] text-[#536073]';
};

const MetricCard = ({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone: 'pink' | 'blue' | 'green' | 'yellow';
}) => {
  const palette = {
    pink: 'bg-[#FFF0F4] text-[#FF6F8F]',
    blue: 'bg-[#EFF7FF] text-[#3C8CC9]',
    green: 'bg-[#F0FAF4] text-[#168B5E]',
    yellow: 'bg-[#FFF8D8] text-[#9D6A00]',
  }[tone];

  return (
    <Card noPadding className="rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-4 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase text-[#8B929C]">{label}</p>
          <p className="mt-2 text-[26px] font-black leading-none text-[#2F2925]">{value}</p>
          <p className="mt-2 text-[12px] font-bold text-[#7B8491]">{helper}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${palette}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
};

export const Reports = () => {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [budgetMonth, setBudgetMonth] = useState(currentMonthInput);
  const [preset, setPreset] = useState<PresetKey>('6m');
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [report, setReport] = useState<ReportData>(() =>
    sampleReport({ startDate: defaultStartDate(), endDate: defaultEndDate(), budgetMonth: currentMonthInput() }),
  );

  const requestedRange = useMemo(() => ({ startDate, endDate, budgetMonth }), [budgetMonth, endDate, startDate]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get('/reports', {
          params: {
            startDate,
            endDate,
            month: budgetMonth,
          },
        });
        if (!alive) return;
        setReport(normalizeReport(response.data, requestedRange));
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        setReport(sampleReport(requestedRange));
        setOfflineMode(true);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [budgetMonth, endDate, reloadKey, requestedRange, startDate]);

  const trendChart = useMemo(
    () =>
      report.monthlyTrend.map((item) => ({
        month: shortMonth(item.month),
        Income: item.income,
        Expenses: item.expense,
        Net: item.net,
      })),
    [report.monthlyTrend],
  );

  const categoryChart = useMemo(
    () =>
      report.categoryBreakdown.map((item, index) => ({
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [report.categoryBreakdown],
  );

  const topCategory = categoryChart[0];
  const budgetProgressColor = report.budgetHealth.progress > 100 ? '#C44B61' : report.budgetHealth.progress >= 80 ? '#D88720' : '#168B5E';

  const applyPreset = (nextPreset: PresetKey) => {
    const now = new Date();
    setPreset(nextPreset);
    if (nextPreset === '3m') {
      setStartDate(toInputDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
      setEndDate(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      setBudgetMonth(currentMonthInput());
    } else if (nextPreset === '6m') {
      setStartDate(defaultStartDate());
      setEndDate(defaultEndDate());
      setBudgetMonth(currentMonthInput());
    } else {
      setStartDate(toInputDate(new Date(now.getFullYear(), 0, 1)));
      setEndDate(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      setBudgetMonth(currentMonthInput());
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `ai-accountant-report-${report.range.startDate}-to-${report.range.endDate}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="reports-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="flex flex-col gap-4 min-[1180px]:flex-row min-[1180px]:items-start min-[1180px]:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#FF7F96]">Insight</span>
            {offlineMode && (
              <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>
          <h2 className="text-[32px] font-black leading-tight text-[#2F2925]">Reports</h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">Review cashflow, categories, and budget health in one place.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['3m', '6m', 'ytd'] as PresetKey[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => applyPreset(item)}
              className={`h-10 rounded-full px-4 text-sm font-black transition-colors ${
                preset === item
                  ? 'bg-[#2F2925] text-white shadow-[0_10px_20px_rgba(47,41,37,0.18)]'
                  : 'border border-[#EFE2D8] bg-white text-[#6F7785] hover:bg-[#FFF8F2]'
              }`}
            >
              {item === 'ytd' ? 'YTD' : item.toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#2F2925] shadow-[0_8px_18px_rgba(92,65,45,0.08)] hover:bg-[#FFF8F2]"
            aria-label="Refresh reports"
          >
            <RefreshCw size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex h-10 items-center gap-2 rounded-full bg-[#FF6F8F] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.25)] hover:bg-[#F35F82]"
          >
            <Download size={17} strokeWidth={2.6} />
            Export
          </button>
        </div>
      </div>

      <Card noPadding className="rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-4 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
        <div className="grid gap-3 min-[900px]:grid-cols-[1fr_1fr_1fr_auto] min-[900px]:items-end">
          <label htmlFor="reports-start-date" className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[#8B929C]">
              <CalendarDays size={14} strokeWidth={3} />
              Start
            </span>
            <input
              id="reports-start-date"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPreset('6m');
              }}
              className="h-11 w-full rounded-[15px] border border-[#EFE2D8] bg-white px-3 text-sm font-bold text-[#4E3629] outline-none focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>
          <label htmlFor="reports-end-date" className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[#8B929C]">
              <CalendarDays size={14} strokeWidth={3} />
              End
            </span>
            <input
              id="reports-end-date"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPreset('6m');
              }}
              className="h-11 w-full rounded-[15px] border border-[#EFE2D8] bg-white px-3 text-sm font-bold text-[#4E3629] outline-none focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>
          <label htmlFor="reports-budget-month" className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[#8B929C]">
              <Target size={14} strokeWidth={3} />
              Budget Month
            </span>
            <input
              id="reports-budget-month"
              type="month"
              value={budgetMonth}
              onChange={(event) => setBudgetMonth(event.target.value)}
              className="h-11 w-full rounded-[15px] border border-[#EFE2D8] bg-white px-3 text-sm font-bold text-[#4E3629] outline-none focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>
          <div className="rounded-[15px] bg-[#FFF8F2] px-4 py-3 text-sm font-black text-[#9D4E2B]">
            {loading ? 'Loading report' : `${report.summary.transactionCount} entries`}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Income"
          value={money.format(report.summary.income)}
          helper={`${report.monthlyTrend.length} months included`}
          tone="green"
          icon={<TrendingUp size={21} strokeWidth={2.7} />}
        />
        <MetricCard
          label="Expenses"
          value={money.format(report.summary.expense)}
          helper={`${report.summary.expenseCount} expense entries`}
          tone="pink"
          icon={<TrendingDown size={21} strokeWidth={2.7} />}
        />
        <MetricCard
          label="Net Saved"
          value={money.format(report.summary.net)}
          helper={`${report.summary.savingsRate}% savings rate`}
          tone="blue"
          icon={<Wallet size={21} strokeWidth={2.7} />}
        />
        <MetricCard
          label="Average Expense"
          value={money.format(report.summary.averageExpense)}
          helper={`Largest ${money.format(report.summary.largestExpense)}`}
          tone="yellow"
          icon={<CircleDollarSign size={21} strokeWidth={2.7} />}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 min-[1180px]:grid-cols-[1.24fr_0.76fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <Card noPadding className="overflow-hidden rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="grid gap-4 p-5 min-[900px]:grid-cols-[1fr_180px] min-[900px]:items-center">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#EFF7FF] text-[#3C8CC9]">
                    <FileBarChart size={19} strokeWidth={2.6} />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-black text-[#2F2925]">Financial Snapshot</h3>
                    <p className="text-[12px] font-bold text-[#8B929C]">
                      {report.range.startDate} to {report.range.endDate}
                    </p>
                  </div>
                </div>
                <p className="max-w-2xl text-sm font-bold leading-relaxed text-[#6F7785]">
                  {topCategory
                    ? `${topCategory.category} is the largest expense lane at ${topCategory.percentage}% while ${readableMonth(report.budgetHealth.month)} budgets are ${report.budgetHealth.progress}% used.`
                    : `No expense categories were recorded for this report range yet.`}
                </p>
              </div>
              <CuteSticker name="reports-cat" className="mx-auto h-[148px] w-[148px]" title="Reports cat with chart" />
            </div>
          </Card>

          <Card noPadding className="flex min-h-[330px] flex-col rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-black text-[#2F2925]">Monthly Flow</h3>
                <p className="text-[12px] font-bold text-[#8B929C]">Income and expenses by month</p>
              </div>
              {loading && (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-3 py-1.5 text-xs font-black text-[#9D4E2B]">
                  <LoaderCircle className="animate-spin" size={14} />
                  Loading
                </span>
              )}
            </div>
            <div className="min-h-[250px] min-w-0 flex-1">
              <ResponsiveContainer width="100%" height={250} minWidth={0}>
                <BarChart data={trendChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#F0E4DA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#8B929C', fontSize: 12, fontWeight: 800 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => compactMoney.format(Number(value))} tick={{ fill: '#8B929C', fontSize: 12, fontWeight: 800 }} axisLine={false} tickLine={false} width={58} />
                  <Tooltip formatter={(value) => money.format(Number(value))} cursor={{ fill: '#FFF7F0' }} />
                  <Bar dataKey="Income" fill="#7ACB9C" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#FF8C94" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 min-[1180px]:grid-cols-2">
            <Card noPadding className="rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#FFF0F4] text-[#FF6F8F]">
                  <Sparkles size={19} strokeWidth={2.6} />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#2F2925]">Smart Notes</h3>
                  <p className="text-[12px] font-bold text-[#8B929C]">Auto-generated from the report</p>
                </div>
              </div>
              <div className="space-y-3">
                {report.insights.map((insight) => (
                  <div key={`${insight.title}-${insight.body}`} className={`rounded-[18px] border px-4 py-3 ${insightToneClass(insight.tone)}`}>
                    <p className="text-sm font-black">{insight.title}</p>
                    <p className="mt-1 text-[12px] font-bold leading-relaxed">{insight.body}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card noPadding className="rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#FFF8D8] text-[#9D6A00]">
                  <AlertTriangle size={19} strokeWidth={2.6} />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#2F2925]">Large Expenses</h3>
                  <p className="text-[12px] font-bold text-[#8B929C]">Highest single purchases</p>
                </div>
              </div>
              <div className="space-y-2">
                {report.largeExpenses.length === 0 ? (
                  <p className="rounded-[18px] bg-[#FFF8F2] px-4 py-4 text-sm font-bold text-[#8B929C]">No large expenses in this range.</p>
                ) : (
                  report.largeExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-3 rounded-[18px] px-3 py-3 hover:bg-[#FFF8F2]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2F2925]">{expense.description}</p>
                        <p className="mt-0.5 text-[11px] font-bold text-[#8B929C]">
                          {expense.category} - {formatDate(expense.date)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-[#C44B61]">-{money.format(expense.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <Card noPadding className="flex min-h-[360px] flex-[1_1_360px] flex-col overflow-hidden rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)] min-[1180px]:max-h-[390px]">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#F0FAF4] text-[#168B5E]">
                  <Target size={19} strokeWidth={2.6} />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#2F2925]">Budget Health</h3>
                  <p className="text-[12px] font-bold text-[#8B929C]">{readableMonth(report.budgetHealth.month)}</p>
                </div>
              </div>
              <span className="rounded-full bg-[#FFF2E7] px-3 py-1.5 text-xs font-black text-[#9D4E2B]">
                {report.budgetHealth.progress}%
              </span>
            </div>

            <div className="shrink-0 rounded-[20px] bg-[#FFF8F2] p-4">
              <div className="mb-3 flex items-center justify-between text-sm font-black text-[#2F2925]">
                <span>{money.format(report.budgetHealth.totalSpent)}</span>
                <span>{money.format(report.budgetHealth.totalBudget)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#EFE4DA]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(report.budgetHealth.progress, 100)}%`, backgroundColor: budgetProgressColor }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[15px] bg-white px-2 py-2">
                  <p className="text-[17px] font-black text-[#C44B61]">{report.budgetHealth.overBudget}</p>
                  <p className="text-[10px] font-black uppercase text-[#8B929C]">Over</p>
                </div>
                <div className="rounded-[15px] bg-white px-2 py-2">
                  <p className="text-[17px] font-black text-[#B66B12]">{report.budgetHealth.watch}</p>
                  <p className="text-[10px] font-black uppercase text-[#8B929C]">Watch</p>
                </div>
                <div className="rounded-[15px] bg-white px-2 py-2">
                  <p className="text-[17px] font-black text-[#168B5E]">{report.budgetHealth.onTrack}</p>
                  <p className="text-[10px] font-black uppercase text-[#8B929C]">On Track</p>
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-auto pr-1">
              {report.budgetHealth.categories.length === 0 ? (
                <div className="rounded-[18px] bg-[#FFF8F2] px-4 py-5 text-center">
                  <p className="text-sm font-black text-[#2F2925]">No budgets for this month</p>
                  <p className="mt-1 text-[12px] font-bold text-[#8B929C]">Create monthly limits to unlock budget tracking.</p>
                </div>
              ) : (
                report.budgetHealth.categories.map((budget) => (
                  <div key={budget.id} className="rounded-[18px] border border-[#F0E4DA] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2F2925]">{budget.category}</p>
                        <p className="text-[11px] font-bold text-[#8B929C]">{money.format(budget.remaining)} remaining</p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ color: statusColor(budget.status), backgroundColor: `${budget.color}22` }}>
                        {statusLabel(budget.status)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#EFE4DA]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(budget.progress, 100)}%`, backgroundColor: statusColor(budget.status) }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] font-black text-[#8B929C]">
                      <span>{money.format(budget.spent)} spent</span>
                      <span>{budget.progress}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card noPadding className="flex min-h-[230px] flex-[0_1_260px] flex-col overflow-hidden rounded-[24px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#F7F1FF] text-[#8957B8]">
                  <PieChartIcon size={19} strokeWidth={2.6} />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#2F2925]">Category Share</h3>
                  <p className="text-[12px] font-bold text-[#8B929C]">{topCategory ? `${topCategory.category} leads` : 'No expenses yet'}</p>
                </div>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 min-[1180px]:grid-cols-[150px_1fr] min-[1440px]:grid-cols-[170px_1fr]">
              <div className="min-h-[132px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={categoryChart} dataKey="total" nameKey="category" innerRadius={38} outerRadius={58} paddingAngle={3}>
                      {categoryChart.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money.format(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-h-0 space-y-2 overflow-auto pr-1">
                {categoryChart.map((category) => (
                  <div key={category.category} className="flex items-center justify-between gap-3 rounded-[16px] px-2 py-2 hover:bg-[#FFF8F2]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2F2925]">{category.category}</p>
                        <p className="text-[11px] font-bold text-[#8B929C]">{category.transactionCount} entries</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#2F2925]">{money.format(category.total)}</p>
                      <p className="text-[11px] font-black text-[#FF6F8F]">{category.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
