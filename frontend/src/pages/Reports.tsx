import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Flag,
  Search,
  Bell,
  ChevronDown,
  LoaderCircle,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { money } from '../utils/formatters';
import { asRecord, asRecordArray, toNumber } from '../utils/records';

interface CategoryShare {
  category: string;
  total: number;
  percentage: number;
}

interface TrendPoint {
  date: string;
  amount: number;
}

interface SummaryData {
  income: number;
  expense: number;
  savingsRate: number;
  net: number;
}

type RangePresetKey = '7d' | '30d' | '3m' | '6m' | '1y' | 'all';

interface PresetOption {
  key: RangePresetKey;
  label: string;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    payload?: Partial<TrendPoint>;
  }>;
}

const RANGE_PRESETS: PresetOption[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '300' }, // Match the mockup's visual representation of 30D
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];

const MOCK_CATEGORIES = [
  { category: 'Food & Dining', total: 570.57, percentage: 35 },
  { category: 'Transport', total: 407.55, percentage: 25 },
  { category: 'Shopping', total: 326.04, percentage: 20 },
  { category: 'Entertainment', total: 195.62, percentage: 12 },
  { category: 'Others', total: 130.42, percentage: 8 },
];

const MOCK_TREND_DATA: TrendPoint[] = [
  { date: 'Oct 1', amount: 60 },
  { date: 'Oct 3', amount: 30 },
  { date: 'Oct 5', amount: 50 },
  { date: 'Oct 7', amount: 40 },
  { date: 'Oct 9', amount: 60 },
  { date: 'Oct 10', amount: 50 },
  { date: 'Oct 11', amount: 80 },
  { date: 'Oct 13', amount: 65 },
  { date: 'Oct 15', amount: 55 },
  { date: 'Oct 16', amount: 64 },
  { date: 'Oct 17', amount: 62 },
  { date: 'Oct 19', amount: 58 },
  { date: 'Oct 21', amount: 68 },
  { date: 'Oct 22', amount: 60 },
  { date: 'Oct 23', amount: 72 },
  { date: 'Oct 24', amount: 64 },
  { date: 'Oct 25', amount: 80 },
  { date: 'Oct 26', amount: 100 },
  { date: 'Oct 28', amount: 90 },
  { date: 'Oct 29', amount: 80 },
];

const CHART_COLORS = ['#FF8C94', '#64B5F6', '#FFD54F', '#BA68C8', '#8C9EFF', '#7ACB9C', '#FFB87A', '#4DB6AC'];

const getDatesForPreset = (preset: RangePresetKey) => {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDate = (() => {
    const d = new Date(today);
    if (preset === '7d') {
      d.setDate(today.getDate() - 7);
      return d.toISOString().slice(0, 10);
    }
    if (preset === '30d') {
      d.setDate(today.getDate() - 30);
      return d.toISOString().slice(0, 10);
    }
    if (preset === '3m') {
      d.setMonth(today.getMonth() - 3);
      return d.toISOString().slice(0, 10);
    }
    if (preset === '6m') {
      d.setMonth(today.getMonth() - 6);
      return d.toISOString().slice(0, 10);
    }
    if (preset === '1y') {
      d.setFullYear(today.getFullYear() - 1);
      return d.toISOString().slice(0, 10);
    }
    return '2000-01-01';
  })();

  return { startDate, endDate };
};

const MeasuredChart = ({
  children,
  className,
}: {
  children: (size: { width: number; height: number }) => ReactNode;
  className: string;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize((current) => {
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        return current.width === width && current.height === height ? current : { width, height };
      });
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      const handle = window.setTimeout(updateSize, 0);
      return () => window.clearTimeout(handle);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const ready = size.width > 0 && size.height > 0;

  return (
    <div ref={ref} className={className}>
      {ready ? children(size) : null}
    </div>
  );
};

export const Reports = () => {
  const [preset, setPreset] = useState<RangePresetKey>('30d');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);

  // Dynamic state loaded from APIs
  const [summary, setSummary] = useState<SummaryData>({
    income: 5200,
    expense: 1820.20,
    savingsRate: 62.7,
    net: 3379.80,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryShare[]>(MOCK_CATEGORIES);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>(MOCK_TREND_DATA);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['Food & Dining', 'Transport', 'Shopping', 'Entertainment', 'Others']);

  const resetToMockData = useCallback(() => {
    if (categoryFilter === 'all') {
      setSummary({
        income: 5200,
        expense: 1820.20,
        savingsRate: 62.7,
        net: 3379.80,
      });
      setCategoryBreakdown(MOCK_CATEGORIES);
      setTrendPoints(MOCK_TREND_DATA);
    } else {
      const selected = MOCK_CATEGORIES.find((c) => c.category === categoryFilter);
      if (selected) {
        const net = 5200 - selected.total;
        setSummary({
          income: 5200,
          expense: selected.total,
          savingsRate: Math.round((net / 5200) * 1000) / 10,
          net,
        });
        setCategoryBreakdown([
          {
            category: selected.category,
            total: selected.total,
            percentage: 100,
          },
        ]);
        const scaledTrend = MOCK_TREND_DATA.map((pt) => ({
          ...pt,
          amount: Math.round(pt.amount * (selected.percentage / 100) * 100) / 100,
        }));
        setTrendPoints(scaledTrend);
      } else {
        setSummary({
          income: 5200,
          expense: 0,
          savingsRate: 100,
          net: 5200,
        });
        setCategoryBreakdown([]);
        setTrendPoints([]);
      }
    }
  }, [categoryFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDatesForPreset(preset);

    try {
      // Fetch report overview for categories & metrics
      const reportRes = await api.get('/reports', {
        params: { startDate, endDate },
      });
      const reportData = asRecord(reportRes.data);
      const summaryData = asRecord(reportData.summary);
      const categoriesList = asRecordArray(reportData.categoryBreakdown);

      // Fetch transactions to compute daily trend & categories list
      const txRes = await api.get('/transactions', {
        params: { startDate, endDate, pageSize: 200 },
      });
      const txData = asRecord(txRes.data);
      const transactions = asRecordArray(txData.transactions);

      // Populate category options
      const catsSet = new Set<string>();
      transactions.forEach((tx) => {
        const cat = String(asRecord(tx).category);
        if (cat) catsSet.add(cat);
      });
      setCategoryOptions(Array.from(catsSet).sort());

      // Filter transactions by selected category if applicable
      const filteredTxs = transactions.filter((tx) => {
        const item = asRecord(tx);
        return categoryFilter === 'all' || item.category === categoryFilter;
      });

      // Compute summary metrics dynamically if data exists
      if (transactions.length > 0) {
        let income = 0;
        let expense = 0;

        filteredTxs.forEach((tx) => {
          const item = asRecord(tx);
          const amt = toNumber(item.amount);
          if (item.type === 'income') {
            income += amt;
          } else if (item.type === 'expense') {
            expense += amt;
          }
        });

        // If category is filtered, only expense of that category exists, so keep total income
        if (categoryFilter !== 'all') {
          income = toNumber(summaryData.income);
        }

        const net = income - expense;
        const savingsRate = income > 0 ? Math.round((net / income) * 1000) / 10 : 0;

        setSummary({
          income,
          expense,
          savingsRate,
          net,
        });

        // Compute dynamic category breakdown
        if (categoryFilter === 'all') {
          const mappedBreakdown = categoriesList.map((item) => {
            const row = asRecord(item);
            return {
              category: String(row.category),
              total: toNumber(row.total),
              percentage: toNumber(row.percentage),
            };
          });
          setCategoryBreakdown(mappedBreakdown.length > 0 ? mappedBreakdown : MOCK_CATEGORIES);
        } else {
          const categoryItem = categoriesList.find(
            (item) => String(asRecord(item).category) === categoryFilter
          );
          if (categoryItem) {
            const row = asRecord(categoryItem);
            setCategoryBreakdown([
              {
                category: String(row.category),
                total: toNumber(row.total),
                percentage: 100,
              },
            ]);
          } else {
            setCategoryBreakdown([]);
          }
        }

        // Compute daily trend points
        const dailyTotals: Record<string, number> = {};
        filteredTxs
          .filter((tx) => asRecord(tx).type === 'expense')
          .forEach((tx) => {
            const item = asRecord(tx);
            const dateStr = String(item.date).slice(0, 10);
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            const amt = toNumber(item.amount);
            dailyTotals[formattedDate] = (dailyTotals[formattedDate] || 0) + amt;
          });

        const sortedTrend = Object.keys(dailyTotals)
          .map((date) => ({
            date,
            amount: Math.round(dailyTotals[date] * 100) / 100,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setTrendPoints(sortedTrend.length > 0 ? sortedTrend : MOCK_TREND_DATA);
      } else {
        // Fallback
        resetToMockData();
      }

      setOfflineMode(false);
    } catch {
      // Offline fallback
      resetToMockData();
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  }, [preset, categoryFilter, resetToMockData]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const dailyAverage = useMemo(() => {
    if (trendPoints.length === 0) return 0;
    const total = trendPoints.reduce((sum, pt) => sum + pt.amount, 0);
    return Math.round((total / (preset === '7d' ? 7 : 30)) * 100) / 100;
  }, [trendPoints, preset]);

  const pieData = useMemo(() => {
    return categoryBreakdown.map((item, index) => ({
      name: item.category,
      value: item.total,
      percentage: item.percentage,
      color: index < CHART_COLORS.length ? CHART_COLORS[index] : CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [categoryBreakdown]);

  const breakdownTotal = useMemo(() => {
    return categoryBreakdown.reduce((sum, item) => sum + item.total, 0);
  }, [categoryBreakdown]);

  const CustomTrendTooltip = ({ active, payload }: TrendTooltipProps) => {
    const item = payload?.[0];
    if (active && item) {
      return (
        <div className="rounded-[14px] border border-[#EFE2D8] bg-[#FFFDFB] p-2.5 shadow-[0_8px_20px_rgba(92,65,45,0.12)]">
          <p className="text-[11px] font-black text-[#8B929C]">{item.payload?.date}</p>
          <p className="mt-1 text-sm font-black text-[#FF6F8F]">{money.format(Number(item.value ?? 0))}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="reports-page flex h-full min-h-0 flex-col gap-6 text-[#4E3629]">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FF7F96]">
              Financial Overview
            </span>
            {offlineMode && (
              <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0F2] text-[#FF7F96]">
              <Flag size={20} strokeWidth={2.7} />
            </span>
            <h2 className="text-[32px] font-black leading-tight tracking-tight text-[#2F2925]">
              Reports
            </h2>
          </div>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">
            Analyze your financial trends and patterns.
          </p>
        </div>

        {/* Search & Bell Icons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#2F2925] shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Search"
          >
            <Search size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#2F2925] shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Filters and Dropdown */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Preset Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {RANGE_PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPreset(item.key)}
              className={`h-9 cursor-pointer rounded-full px-4 text-sm font-black transition-colors ${
                preset === item.key
                  ? 'bg-[#FFF0F2] text-[#FF6F8F]'
                  : 'bg-transparent text-[#6F7785] hover:bg-[#FFF8F2] hover:text-[#2F2925]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Categories Dropdown */}
        <div className="relative w-full sm:w-48 shrink-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-11 w-full cursor-pointer appearance-none rounded-[16px] border border-[#EFE2D8] bg-white pl-4 pr-10 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.04)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
            aria-label="Categories filter"
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8B929C]">
            <ChevronDown size={15} strokeWidth={3} />
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Spending Trend Area Chart */}
        <Card
          noPadding
          className="flex min-h-[380px] flex-col rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)]"
        >
          <div className="mb-4">
            <h3 className="text-lg font-black text-[#2F2925]">Spending Trend</h3>
            <p className="text-sm font-bold text-[#6F7785]">
              Daily average:{' '}
              <span className="font-extrabold text-[#2F2925]">
                {money.format(dailyAverage === 0 ? 60.67 : dailyAverage)}
              </span>
            </p>
          </div>

          <div className="flex-1 min-h-[220px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <LoaderCircle className="animate-spin text-[#FF7F96]" size={28} />
              </div>
            ) : (
              <MeasuredChart className="h-[220px] w-full">
                {({ width, height }) => (
                  <AreaChart
                    width={width}
                    height={height}
                    data={trendPoints}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF6F8F" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#FF6F8F" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#FAF2EA"
                      vertical={true}
                      horizontal={true}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#8B929C', fontSize: 11, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickFormatter={(value) => `$${value}`}
                      tick={{ fill: '#8B929C', fontSize: 11, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip content={<CustomTrendTooltip />} cursor={{ stroke: '#FFD1DC' }} />
                    <Area
                      type="linear"
                      dataKey="amount"
                      stroke="#FF7F96"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorSpending)"
                    />
                  </AreaChart>
                )}
              </MeasuredChart>
            )}
          </div>
        </Card>

        {/* Category Breakdown Donut Chart */}
        <Card
          noPadding
          className="flex min-h-[380px] flex-col rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)]"
        >
          <div className="mb-4">
            <h3 className="text-lg font-black text-[#2F2925]">Category Breakdown</h3>
            <p className="text-sm font-bold text-[#6F7785]">
              Total:{' '}
              <span className="font-extrabold text-[#2F2925]">
                {money.format(breakdownTotal === 0 ? 1630.20 : breakdownTotal)}
              </span>
            </p>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row min-h-[220px]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <LoaderCircle className="animate-spin text-[#FF7F96]" size={28} />
              </div>
            ) : categoryBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-sm font-black text-[#8B929C]">No category data available.</p>
              </div>
            ) : (
              <>
                <div className="relative flex h-[180px] w-[180px] shrink-0 items-center justify-center">
                  <MeasuredChart className="h-[180px] w-[180px]">
                    {({ width, height }) => (
                      <PieChart width={width} height={height}>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => money.format(Number(value))} />
                      </PieChart>
                    )}
                  </MeasuredChart>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 w-full">
                  {pieData.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm font-bold text-[#536073]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate max-w-[140px] text-[#536073]">
                          {entry.name}
                        </span>
                      </div>
                      <span className="font-extrabold text-[#2F2925]">
                        {entry.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Monthly Summary Cards Section */}
      <Card
        noPadding
        className="relative overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-6 shadow-[0_12px_28px_rgba(92,65,45,0.06)]"
      >
        <h3 className="mb-5 text-lg font-black text-[#2F2925]">Monthly Summary</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 relative z-[1]">
          {/* Income block */}
          <div className="rounded-[20px] border border-[#FAF2EA] bg-[#FAF8F5] p-5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.02)]">
            <p className="text-xs font-black uppercase text-[#8B929C]">Income</p>
            <p className="mt-3 truncate text-[25px] font-black leading-tight text-[#2F2925]">
              {money.format(summary.income)}
            </p>
          </div>

          {/* Expenses block */}
          <div className="rounded-[20px] border border-[#FAF2EA] bg-[#FAF8F5] p-5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.02)]">
            <p className="text-xs font-black uppercase text-[#FF7F96]">Expenses</p>
            <p className="mt-3 truncate text-[25px] font-black leading-tight text-[#2F2925]">
              {money.format(summary.expense)}
            </p>
          </div>

          {/* Savings Rate block */}
          <div className="rounded-[20px] border border-[#FAF2EA] bg-[#FAF8F5] p-5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.02)]">
            <p className="text-xs font-black uppercase text-[#8B929C]">Savings Rate</p>
            <p className="mt-3 truncate text-[25px] font-black leading-tight text-[#55B978]">
              {summary.savingsRate}%
            </p>
          </div>

          {/* Net Savings block with Peeking Cat */}
          <div className="relative overflow-visible rounded-[20px] border border-[#FAF2EA] bg-[#FAF8F5] p-5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.02)]">
            <p className="text-xs font-black uppercase text-[#8B929C]">Net Savings</p>
            <p className="mt-3 truncate text-[25px] font-black leading-tight text-[#55B978]">
              {money.format(summary.net)}
            </p>

            {/* Cute Cat peeking over Net Savings card edge */}
            <CuteSticker
              name="logo-cat"
              className="absolute bottom-0 right-4 h-16 w-20 translate-y-[12%] translate-x-[8%] z-[2] drop-shadow-[0_6px_10px_rgba(92,65,45,0.08)]"
              title="Net savings helper"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};
