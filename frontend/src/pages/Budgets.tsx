import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Bus,
  CalendarDays,
  Gamepad2,
  HeartPulse,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { COLORS, fallbackColor, type ColorName } from '../constants/palette';
import { currentMonthInput, money, readableMonth } from '../utils/formatters';
import { asRecord, asRecordArray, toNumber, type RawRecord } from '../utils/records';

interface BudgetItem {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  progress: number;
  status: BudgetStatus;
  periodMonth: string;
  icon: IconName;
  color: ColorName;
  notes: string;
}

interface BudgetSummary {
  month: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  progress: number;
  count: number;
  overBudget: number;
}

interface BudgetFormState {
  category: string;
  amount: string;
  periodMonth: string;
  icon: IconName;
  color: ColorName;
  notes: string;
}

type BudgetStatus = 'on_track' | 'watch' | 'over';

const ICONS = {
  utensils: Utensils,
  bus: Bus,
  'shopping-bag': ShoppingBag,
  gamepad: Gamepad2,
  receipt: ReceiptText,
  'heart-pulse': HeartPulse,
  wallet: Wallet,
  tag: Tag,
  'more-horizontal': MoreHorizontal,
} satisfies Record<string, LucideIcon>;

type IconName = keyof typeof ICONS;

const ICON_OPTIONS: IconName[] = [
  'utensils',
  'bus',
  'shopping-bag',
  'gamepad',
  'receipt',
  'heart-pulse',
  'wallet',
  'tag',
  'more-horizontal',
];

const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Transport',
  'Entertainment',
  'Bills & Utilities',
  'Health & Fitness',
  'Other',
  '餐饮',
  '交通',
  '购物',
  '其他',
];

const fallbackIcon = (value: unknown): IconName =>
  typeof value === 'string' && value in ICONS ? (value as IconName) : 'tag';

const progressFrom = (spent: number, amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round((spent / amount) * 100);
};

const statusFrom = (progress: number): BudgetStatus => {
  if (progress > 100) return 'over';
  if (progress >= 80) return 'watch';
  return 'on_track';
};

const normalizeBudget = (raw: RawRecord, index: number, month: string): BudgetItem => {
  const amount = toNumber(raw.amount ?? raw.budget ?? raw.budgetAmount);
  const spent = toNumber(raw.spent);
  const remaining = toNumber(raw.remaining, amount - spent);
  const progress = toNumber(raw.progress, progressFrom(spent, amount));
  const status = raw?.status === 'over' || raw?.status === 'watch' ? raw.status : statusFrom(progress);

  return {
    id: String(raw.id ?? `local-${index}`),
    category: String(raw.category ?? raw.categoryName ?? raw.name ?? 'Other'),
    amount,
    spent,
    remaining,
    progress,
    status,
    periodMonth: String(raw.period_month ?? raw.periodMonth ?? raw.month ?? month),
    icon: fallbackIcon(raw.icon),
    color: fallbackColor(raw.color),
    notes: String(raw.notes ?? raw.description ?? ''),
  };
};

const computeSummary = (month: string, rows: BudgetItem[]): BudgetSummary => {
  const totals = rows.reduce(
    (next, budget) => {
      next.totalBudget += budget.amount;
      next.totalSpent += budget.spent;
      if (budget.status === 'over') next.overBudget += 1;
      return next;
    },
    { totalBudget: 0, totalSpent: 0, overBudget: 0 },
  );
  const remaining = totals.totalBudget - totals.totalSpent;

  return {
    month,
    totalBudget: totals.totalBudget,
    totalSpent: totals.totalSpent,
    remaining,
    progress: progressFrom(totals.totalSpent, totals.totalBudget),
    count: rows.length,
    overBudget: totals.overBudget,
  };
};

const normalizeSummary = (raw: unknown, month: string, rows: BudgetItem[]): BudgetSummary => {
  const data = asRecord(raw);
  const fallback = computeSummary(month, rows);
  return {
    month: String(data.month ?? month),
    totalBudget: toNumber(data.totalBudget ?? data.total_budget, fallback.totalBudget),
    totalSpent: toNumber(data.totalSpent ?? data.total_spent, fallback.totalSpent),
    remaining: toNumber(data.remaining, fallback.remaining),
    progress: toNumber(data.progress, fallback.progress),
    count: toNumber(data.count, fallback.count),
    overBudget: toNumber(data.overBudget ?? data.over_budget, fallback.overBudget),
  };
};

const normalizeBudgetResponse = (data: unknown, month: string) => {
  const source = asRecord(data);
  const rows = asRecordArray(source.budgets).map((budget, index) => normalizeBudget(budget, index, month));
  return { rows, summary: normalizeSummary(source.summary, month, rows) };
};

const categoryOptionsFromResponse = (data: unknown) => {
  const names = asRecordArray(asRecord(data).categories)
    .filter((category) => category.type !== 'income')
    .map((category) => String(category.name || '').trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_CATEGORIES, ...names])).sort((a, b) => a.localeCompare(b));
};

const emptyForm = (periodMonth: string): BudgetFormState => ({
  category: 'Food & Dining',
  amount: '',
  periodMonth,
  icon: 'tag',
  color: '#FF8C94',
  notes: '',
});

const visualForCategory = (category: string): Pick<BudgetItem, 'icon' | 'color'> => {
  const text = category.toLowerCase();
  if (text.includes('food') || text.includes('dining') || text.includes('餐')) return { icon: 'utensils', color: '#FF8C94' };
  if (text.includes('transport') || text.includes('bus') || text.includes('交通')) return { icon: 'bus', color: '#64B5F6' };
  if (text.includes('shopping') || text.includes('shop') || text.includes('购物')) return { icon: 'shopping-bag', color: '#FFD54F' };
  if (text.includes('entertainment') || text.includes('game')) return { icon: 'gamepad', color: '#BA68C8' };
  if (text.includes('health') || text.includes('fitness')) return { icon: 'heart-pulse', color: '#F27C8B' };
  if (text.includes('bill') || text.includes('util')) return { icon: 'receipt', color: '#4DB6AC' };
  if (text.includes('subscription') || text.includes('streaming')) return { icon: 'receipt', color: '#BA68C8' };
  return { icon: 'tag', color: '#FF8C94' };
};

const IconBadge = ({ budget, size = 'md' }: { budget: Pick<BudgetItem, 'icon' | 'color'>; size?: 'sm' | 'md' }) => {
  const Icon = ICONS[budget.icon] || Tag;
  const dims = size === 'sm' ? 'h-9 w-9 rounded-[14px]' : 'h-11 w-11 rounded-[16px]';
  const iconSize = size === 'sm' ? 17 : 20;

  return (
    <span
      className={`flex shrink-0 items-center justify-center ${dims} shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]`}
      style={{ backgroundColor: `${budget.color}26`, color: budget.color }}
    >
      <Icon size={iconSize} strokeWidth={2.7} />
    </span>
  );
};

const ProgressBar = ({ progress }: { progress: number }) => {
  const color = progress > 100 ? '#F27C8B' : progress >= 80 ? '#FFB85C' : '#3BB878';
  return (
    <div className="flex min-w-[188px] items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EFE4DA]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }} />
      </div>
      <span className={`w-11 text-right text-[13px] font-black ${progress > 100 ? 'text-[#C44B61]' : 'text-[#536073]'}`}>
        {progress}%
      </span>
    </div>
  );
};

export const Budgets = () => {
  const [month, setMonth] = useState(currentMonthInput());
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>(() => computeSummary(currentMonthInput(), []));
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormState>(() => emptyForm(currentMonthInput()));

  useEffect(() => {
    let alive = true;

    api.get('/categories', { params: { type: 'expense' } })
      .then((response) => {
        if (!alive) return;
        setCategoryOptions(categoryOptionsFromResponse(response.data));
      })
      .catch(() => {
        if (alive) setCategoryOptions(DEFAULT_CATEGORIES);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get('/budgets', { params: { month } });
        if (!alive) return;
        const next = normalizeBudgetResponse(response.data, month);
        setBudgets(next.rows);
        setSummary(next.summary);
      } catch {
        if (!alive) return;
        setBudgets([]);
        setSummary(computeSummary(month, []));
        setError('Could not load budgets. Check the backend connection and try again.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [month, reloadKey]);

  const topBudget = useMemo(
    () => [...budgets].sort((a, b) => b.progress - a.progress || b.spent - a.spent)[0],
    [budgets],
  );

  const filteredBudgets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return budgets;
    return budgets.filter((budget) =>
      [budget.category, budget.notes, budget.status, readableMonth(budget.periodMonth)]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [budgets, searchTerm]);

  const budgetAlerts = useMemo(
    () => budgets.filter((budget) => budget.status === 'over' || budget.status === 'watch'),
    [budgets],
  );

  const refreshRemoteRows = async (selectedMonth = month) => {
    const response = await api.get('/budgets', { params: { month: selectedMonth } });
    const next = normalizeBudgetResponse(response.data, selectedMonth);
    setBudgets(next.rows);
    setSummary(next.summary);
  };

  const openCreateDrawer = () => {
    setEditing(null);
    setForm(emptyForm(month));
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (budget: BudgetItem) => {
    setEditing(budget);
    setForm({
      category: budget.category,
      amount: String(budget.amount),
      periodMonth: budget.periodMonth,
      icon: budget.icon,
      color: budget.color,
      notes: budget.notes,
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const handleCategoryChange = (category: string) => {
    const visual = visualForCategory(category);
    setForm((current) => ({
      ...current,
      category,
      icon: current.icon === 'tag' ? visual.icon : current.icon,
      color: current.color === '#FF8C94' ? visual.color : current.color,
    }));
  };

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!form.category.trim()) {
      setFormError('Category is required.');
      return;
    }
    if (!form.periodMonth.match(/^\d{4}-\d{2}$/)) {
      setFormError('Month is invalid.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      category: form.category.trim(),
      amount,
      month: form.periodMonth,
      icon: form.icon,
      color: form.color,
      notes: form.notes.trim(),
    };

    try {
      if (editing) {
        await api.patch(`/budgets/${editing.id}`, payload);
        setMonth(payload.month);
        await refreshRemoteRows(payload.month);
      } else {
        await api.post('/budgets', payload);
        setMonth(payload.month);
        await refreshRemoteRows(payload.month);
      }

      setDrawerOpen(false);
      setEditing(null);
    } catch {
      setFormError('Could not save this budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budget: BudgetItem) => {
    const confirmed = window.confirm(`Delete "${budget.category}" budget?`);
    if (!confirmed) return;

    try {
      await api.delete(`/budgets/${budget.id}`);
      await refreshRemoteRows();
    } catch {
      setError('Could not delete this budget.');
    }
  };

  return (
    <div className="budgets-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="flex flex-col gap-4 min-[1120px]:flex-row min-[1120px]:items-start min-[1120px]:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#FF7F96]">Plan</span>
          </div>
          <h2 className="text-[32px] font-black leading-tight tracking-tight text-[#2F2925]">Budgets</h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">Set and manage your monthly budgets.</p>
        </div>

        <div className="relative flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open);
              setAlertsOpen(false);
            }}
            aria-expanded={searchOpen}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Search budgets"
          >
            <Search size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAlertsOpen((open) => !open);
              setSearchOpen(false);
            }}
            aria-expanded={alertsOpen}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Budget alerts"
          >
            <Bell size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-12 z-20 w-[320px] rounded-[20px] border border-[#EFE2D8] bg-white p-3 shadow-[0_18px_36px_rgba(92,65,45,0.14)]">
              <label htmlFor="budget-search" className="sr-only">Search budgets</label>
              <div className="flex h-11 items-center gap-2 rounded-[15px] border border-[#EFE2D8] bg-[#FFFDFB] px-3 focus-within:ring-4 focus-within:ring-[#FFD1DC]/40">
                <Search size={16} strokeWidth={2.5} className="text-[#8B929C]" />
                <input
                  id="budget-search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search category or notes"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-[#4E3629] outline-none placeholder:text-[#A7A0A0]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#8B929C] hover:bg-[#FFF2E7] hover:text-[#4E3629]"
                    aria-label="Clear budget search"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-[11px] font-black text-[#8B929C]">
                {filteredBudgets.length} of {budgets.length} budgets shown
              </p>
            </div>
          )}
          {alertsOpen && (
            <div className="absolute right-0 top-12 z-20 w-[320px] rounded-[20px] border border-[#EFE2D8] bg-white p-3 shadow-[0_18px_36px_rgba(92,65,45,0.14)]">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[13px] font-black text-[#2F2925]">Budget Alerts</p>
                <span className="rounded-full bg-[#FFF2E7] px-2 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                  {budgetAlerts.length}
                </span>
              </div>
              {budgetAlerts.length === 0 ? (
                <p className="rounded-[15px] bg-[#F5FBF7] px-3 py-3 text-sm font-bold text-[#169B61]">
                  All budgets are on track.
                </p>
              ) : (
                <div className="max-h-[220px] overflow-auto">
                  {budgetAlerts.map((budget) => (
                    <div key={budget.id} className="flex items-center gap-3 rounded-[15px] px-2 py-2 hover:bg-[#FFF8F2]">
                      <IconBadge budget={budget} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#2F2925]">{budget.category}</p>
                        <p className={`text-[11px] font-black ${budget.status === 'over' ? 'text-[#C44B61]' : 'text-[#9D4E2B]'}`}>
                          {budget.progress}% used, {money.format(budget.remaining)} remaining
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label htmlFor="budget-filter-month" className="relative block w-full sm:w-[230px]">
            <span className="sr-only">Budget month</span>
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
            <input
              id="budget-filter-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || currentMonthInput())}
              className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-[#FFFDFB] pl-11 pr-4 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>

          <div className="flex w-full items-center justify-end gap-3 xl:w-auto">
            <CuteSticker
              name="budgets-cat"
              className="pointer-events-none hidden h-16 w-16 shrink-0 select-none drop-shadow-[0_8px_10px_rgba(92,65,45,0.12)] xl:block"
              title="Budgets helper cat"
            />
            <button
              onClick={openCreateDrawer}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-6 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.28)] transition-all hover:translate-y-[-1px] active:translate-y-0 xl:w-auto"
            >
              <Plus size={19} strokeWidth={3} />
              New Budget
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF2E7]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Total Budget</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{money.format(summary.totalBudget)}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#9D4E2B]">{readableMonth(summary.month)}</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF0F2]" />
          <p className="relative z-[1] text-[13px] font-black text-[#FF4F67]">Total Spent</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{money.format(summary.totalSpent)}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#F27C8B]">{summary.overBudget} over budget</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EAFBF1]" />
          <p className="relative z-[1] text-[13px] font-black text-[#169B61]">Remaining</p>
          <p className={`relative z-[1] mt-3 text-[29px] font-black leading-tight ${summary.remaining >= 0 ? 'text-[#169B61]' : 'text-[#C44B61]'}`}>
            {money.format(summary.remaining)}
          </p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#55B978]">{summary.count} active budgets</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EDF5FF]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Overall Progress</p>
          <div className="relative z-[1] mt-6">
            <ProgressBar progress={summary.progress} />
          </div>
        </Card>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61] sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="h-9 rounded-full bg-white px-4 text-sm font-black text-[#C44B61] shadow-[0_8px_18px_rgba(92,65,45,0.08)] hover:bg-[#FFF8F2]"
          >
            Retry
          </button>
        </div>
      )}

      <Card noPadding className="flex min-h-[0] flex-1 flex-col overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
        <div className="flex flex-col gap-3 border-b border-[#EFE2D8] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#FFF2E7] text-[#FF7F96] shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <TrendingUp size={19} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[17px] font-black text-[#2F2925]">Monthly Limits</h3>
              <p className="text-[11px] font-bold text-[#8B929C]">{topBudget ? `${topBudget.category} is at ${topBudget.progress}%` : 'No active budgets'}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5">
          <table className="w-full min-w-[980px] table-fixed border-collapse">
            <thead className="sticky top-0 z-[1] bg-[#FFFDFB]">
              <tr className="border-b border-[#EFE2D8] text-left text-[13px] font-black text-[#536073]">
                <th className="w-[310px] py-4 pr-4">Category</th>
                <th className="w-[160px] px-4 py-4 text-right">Budget</th>
                <th className="w-[160px] px-4 py-4 text-right">Spent</th>
                <th className="w-[170px] px-4 py-4 text-right">Remaining</th>
                <th className="w-[260px] px-4 py-4">Progress</th>
                <th className="w-[116px] py-4 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
                      <LoaderCircle className="animate-spin" size={16} />
                      Loading budgets
                    </div>
                  </td>
                </tr>
              ) : budgets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <CuteSticker name="budgets-cat" className="mx-auto h-[120px] w-[134px]" title="Empty budgets cat" />
                    <p className="mt-2 text-lg font-black text-[#2F2925]">No budgets for {readableMonth(month)}</p>
                    <p className="mt-1 text-sm font-bold text-[#8B929C]">Create a monthly cap for a category.</p>
                  </td>
                </tr>
              ) : filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <p className="text-lg font-black text-[#2F2925]">No matching budgets</p>
                    <p className="mt-1 text-sm font-bold text-[#8B929C]">Try a different category, note, or status.</p>
                  </td>
                </tr>
              ) : (
                filteredBudgets.map((budget) => (
                  <tr key={budget.id} className="border-b border-[#F0E4DA] text-[14px] font-bold text-[#2F2925] last:border-b-0">
                    <td className="py-4 pr-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <IconBadge budget={budget} />
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-black text-[#2F2925]">{budget.category}</p>
                          <p className="mt-0.5 truncate text-[12px] font-bold text-[#8B929C]">{budget.notes || readableMonth(budget.periodMonth)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-black">{money.format(budget.amount)}</td>
                    <td className="px-4 py-4 text-right text-[#536073]">{money.format(budget.spent)}</td>
                    <td className={`px-4 py-4 text-right font-black ${budget.remaining >= 0 ? 'text-[#169B61]' : 'text-[#C44B61]'}`}>
                      {money.format(budget.remaining)}
                    </td>
                    <td className="px-4 py-4">
                      <ProgressBar progress={budget.progress} />
                    </td>
                    <td className="py-4 pl-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditDrawer(budget)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] transition hover:bg-[#FFF8F2] hover:text-[#2F2925]"
                          aria-label={`Edit ${budget.category}`}
                          title="Edit"
                        >
                          <Pencil size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleDelete(budget)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#F4D5DA] bg-white text-[#F27C8B] transition hover:bg-[#FFF0F2]"
                          aria-label={`Delete ${budget.category}`}
                          title="Delete"
                        >
                          <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#4E3629]/20 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit budget' : 'New budget'}
            className="w-full max-w-[760px] rounded-t-[30px] border-x border-t border-[#EFE2D8] bg-[#FAF8F5] p-6 shadow-2xl animate-slide-up"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E8DCD0] pb-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-20 shrink-0 rounded-[22px] bg-[#FFF2E7] p-1.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]">
                  <CuteSticker name="budgets-cat" className="h-full w-full" title="Budget helper" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[#FF7F96]">
                    <Sparkles size={13} strokeWidth={3} />
                    {editing ? 'Update Budget' : 'New Budget'}
                  </div>
                  <h3 className="mt-0.5 text-xl font-black text-[#2F2925]">
                    {editing ? 'Adjust this monthly cap' : 'Create a monthly cap'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2]"
                aria-label="Close budget form"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <div className="grid gap-4 py-5 md:grid-cols-2">
              <label htmlFor="budget-category" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Category</span>
                <input
                  id="budget-category"
                  value={form.category}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  list="budget-categories"
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
                <datalist id="budget-categories">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>

              <label htmlFor="budget-month" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Month</span>
                <input
                  id="budget-month"
                  type="month"
                  value={form.periodMonth}
                  onChange={(event) => setForm((current) => ({ ...current, periodMonth: event.target.value }))}
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <label htmlFor="budget-amount" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Amount</span>
                <div className="flex h-12 items-center rounded-[16px] border border-[#EFE2D8] bg-white px-4 focus-within:ring-4 focus-within:ring-[#FFD1DC]/40">
                  <span className="mr-2 text-sm font-black text-[#8B929C]">$</span>
                  <input
                    id="budget-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    className="h-full w-full bg-transparent text-sm font-bold text-[#4E3629] outline-none"
                  />
                </div>
              </label>

              <label htmlFor="budget-notes" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Notes</span>
                <input
                  id="budget-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Groceries, rides, subscriptions..."
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <div>
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Icon</span>
                <div className="grid grid-cols-6 gap-2">
                  {ICON_OPTIONS.map((icon) => {
                    const Icon = ICONS[icon];
                    return (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, icon }))}
                        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition ${
                          form.icon === icon ? 'border-[#FF7F96] bg-[#FFF0F2] text-[#FF7F96]' : 'border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2]'
                        }`}
                        aria-label={`Use ${icon} icon`}
                        title={icon}
                      >
                        <Icon size={17} strokeWidth={2.6} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Color</span>
                <div className="grid grid-cols-5 gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white"
                      aria-label={`Use ${color} color`}
                      title={color}
                    >
                      <span
                        className={`h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)] ${form.color === color ? 'ring-4 ring-[#FFD1DC]/60' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formError && (
              <div className="mb-4 rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
                {formError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-[#E8DCD0] pt-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-11 cursor-pointer rounded-full border border-[#EFE2D8] bg-white px-5 text-sm font-black text-[#536073] transition hover:bg-[#FFF8F2]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-6 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.24)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
