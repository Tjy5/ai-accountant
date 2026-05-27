import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Check,
  Filter,
  Gift,
  GraduationCap,
  HeartHandshake,
  Home,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target as TargetIcon,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';

type GoalStatus = 'active' | 'paused' | 'completed';
type GoalFilter = 'all' | GoalStatus;
type Pace = 'complete' | 'open' | 'overdue' | 'due_soon' | 'steady';
type RawRecord = Record<string, unknown>;

interface GoalItem {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  remaining: number;
  progress: number;
  targetDate: string;
  status: GoalStatus;
  icon: IconName;
  color: ColorName;
  notes: string;
  daysLeft: number | null;
  pace: Pace;
}

interface GoalSummary {
  totalTarget: number;
  totalSaved: number;
  remaining: number;
  progress: number;
  count: number;
  active: number;
  completed: number;
  dueSoon: number;
}

interface GoalFormState {
  title: string;
  targetAmount: string;
  savedAmount: string;
  targetDate: string;
  status: GoalStatus;
  icon: IconName;
  color: ColorName;
  notes: string;
}

const ICONS = {
  plane: Plane,
  home: Home,
  'graduation-cap': GraduationCap,
  sparkles: Sparkles,
  'piggy-bank': PiggyBank,
  gift: Gift,
  wallet: Wallet,
  target: TargetIcon,
  'heart-handshake': HeartHandshake,
  'more-horizontal': MoreHorizontal,
} satisfies Record<string, LucideIcon>;

type IconName = keyof typeof ICONS;

const ICON_OPTIONS: IconName[] = [
  'target',
  'piggy-bank',
  'plane',
  'home',
  'graduation-cap',
  'sparkles',
  'gift',
  'wallet',
  'heart-handshake',
  'more-horizontal',
];

const COLORS = [
  '#FF8C94',
  '#64B5F6',
  '#FFD54F',
  '#BA68C8',
  '#7ACB9C',
  '#FFB87A',
  '#A1887F',
  '#4DB6AC',
  '#F27C8B',
  '#8C9EFF',
] as const;

type ColorName = (typeof COLORS)[number];

const SAMPLE_GOALS: GoalItem[] = [
  {
    id: 'sample-trip',
    title: 'Japan Trip',
    targetAmount: 2400,
    savedAmount: 900,
    remaining: 1500,
    progress: 38,
    targetDate: '2026-08-15',
    status: 'active',
    icon: 'plane',
    color: '#64B5F6',
    notes: 'Flights, hotel deposit, and train passes.',
    daysLeft: null,
    pace: 'steady',
  },
  {
    id: 'sample-emergency',
    title: 'Emergency Fund',
    targetAmount: 3000,
    savedAmount: 2250,
    remaining: 750,
    progress: 75,
    targetDate: '2026-12-31',
    status: 'active',
    icon: 'piggy-bank',
    color: '#7ACB9C',
    notes: 'Keep three months of essentials ready.',
    daysLeft: null,
    pace: 'steady',
  },
  {
    id: 'sample-course',
    title: 'Design Course',
    targetAmount: 680,
    savedAmount: 680,
    remaining: 0,
    progress: 100,
    targetDate: '2026-06-20',
    status: 'completed',
    icon: 'graduation-cap',
    color: '#BA68C8',
    notes: 'Tuition and a small materials buffer.',
    daysLeft: null,
    pace: 'complete',
  },
];

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

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null;

const asRecordArray = (value: unknown): RawRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const toNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const fallbackIcon = (value: unknown): IconName =>
  typeof value === 'string' && value in ICONS ? (value as IconName) : 'target';

const fallbackColor = (value: unknown): ColorName =>
  COLORS.includes(value as ColorName) ? (value as ColorName) : '#FF8C94';

const fallbackStatus = (value: unknown, progress: number): GoalStatus => {
  if (value === 'active' || value === 'paused' || value === 'completed') return value;
  return progress >= 100 ? 'completed' : 'active';
};

const percent = (saved: number, target: number) => {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.round((saved / target) * 100);
};

const toInputDate = (value: unknown) => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return '';
  return raw.slice(0, 10);
};

const calcDaysLeft = (targetDate: string) => {
  if (!targetDate) return null;
  const target = new Date(`${targetDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const paceFrom = (remaining: number, daysLeft: number | null): Pace => {
  if (remaining <= 0) return 'complete';
  if (daysLeft === null) return 'open';
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 30) return 'due_soon';
  return 'steady';
};

const readableDate = (value: string) => {
  if (!value) return 'No date';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const dueLabel = (goal: GoalItem) => {
  if (goal.remaining <= 0 || goal.status === 'completed') return 'Funded';
  if (goal.daysLeft === null) return 'Open timeline';
  if (goal.daysLeft < 0) return `${Math.abs(goal.daysLeft)} days overdue`;
  if (goal.daysLeft === 0) return 'Due today';
  if (goal.daysLeft === 1) return '1 day left';
  return `${goal.daysLeft} days left`;
};

const statusLabel = (status: GoalStatus) => {
  if (status === 'completed') return 'Completed';
  if (status === 'paused') return 'Paused';
  return 'Active';
};

const statusClass = (status: GoalStatus) => {
  if (status === 'completed') return 'bg-[#EAFBF1] text-[#168B5E]';
  if (status === 'paused') return 'bg-[#FFF2E7] text-[#9D4E2B]';
  return 'bg-[#FFF0F2] text-[#F27C8B]';
};

const emptyForm = (): GoalFormState => ({
  title: '',
  targetAmount: '',
  savedAmount: '0',
  targetDate: '',
  status: 'active',
  icon: 'target',
  color: '#FF8C94',
  notes: '',
});

const normalizeGoal = (raw: RawRecord, index: number): GoalItem => {
  const targetAmount = toNumber(raw.targetAmount ?? raw.target_amount ?? raw.amount);
  const savedAmount = toNumber(raw.savedAmount ?? raw.saved_amount ?? raw.currentAmount ?? raw.current_amount);
  const remaining = toNumber(raw.remaining, Math.max(targetAmount - savedAmount, 0));
  const progress = toNumber(raw.progress, percent(savedAmount, targetAmount));
  const targetDate = toInputDate(raw.targetDate ?? raw.target_date ?? raw.deadline);
  const daysLeft = raw.daysLeft === null || raw.days_left === null
    ? null
    : raw.daysLeft !== undefined || raw.days_left !== undefined
      ? toNumber(raw.daysLeft ?? raw.days_left)
      : calcDaysLeft(targetDate);

  return {
    id: String(raw.id ?? `local-${index}`),
    title: String(raw.title ?? raw.name ?? 'Untitled Goal'),
    targetAmount,
    savedAmount,
    remaining,
    progress,
    targetDate,
    status: fallbackStatus(raw.status, progress),
    icon: fallbackIcon(raw.icon),
    color: fallbackColor(raw.color),
    notes: String(raw.notes ?? raw.description ?? ''),
    daysLeft,
    pace: raw.pace === 'complete' || raw.pace === 'open' || raw.pace === 'overdue' || raw.pace === 'due_soon' || raw.pace === 'steady'
      ? raw.pace
      : paceFrom(remaining, daysLeft),
  };
};

const normalizeSamples = () =>
  SAMPLE_GOALS.map((goal) => {
    const daysLeft = calcDaysLeft(goal.targetDate);
    const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);
    return {
      ...goal,
      remaining,
      progress: percent(goal.savedAmount, goal.targetAmount),
      daysLeft,
      pace: paceFrom(remaining, daysLeft),
    };
  });

const computeSummary = (goals: GoalItem[]): GoalSummary => {
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalSaved = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);

  return {
    totalTarget,
    totalSaved,
    remaining: Math.max(totalTarget - totalSaved, 0),
    progress: percent(totalSaved, totalTarget),
    count: goals.length,
    active: goals.filter((goal) => goal.status === 'active').length,
    completed: goals.filter((goal) => goal.status === 'completed' || goal.progress >= 100).length,
    dueSoon: goals.filter((goal) => goal.daysLeft !== null && goal.daysLeft >= 0 && goal.daysLeft <= 30).length,
  };
};

const normalizeSummary = (raw: unknown, goals: GoalItem[]): GoalSummary => {
  const data = isRecord(raw) ? raw : {};
  const fallback = computeSummary(goals);
  return {
    totalTarget: toNumber(data.totalTarget ?? data.total_target, fallback.totalTarget),
    totalSaved: toNumber(data.totalSaved ?? data.total_saved, fallback.totalSaved),
    remaining: toNumber(data.remaining, fallback.remaining),
    progress: toNumber(data.progress, fallback.progress),
    count: toNumber(data.count, fallback.count),
    active: toNumber(data.active, fallback.active),
    completed: toNumber(data.completed, fallback.completed),
    dueSoon: toNumber(data.dueSoon ?? data.due_soon, fallback.dueSoon),
  };
};

const applyLocalFilters = (goals: GoalItem[], status: GoalFilter, search: string) => {
  const query = search.trim().toLowerCase();
  return goals
    .filter((goal) => status === 'all' || goal.status === status)
    .filter((goal) => {
      if (!query) return true;
      return `${goal.title} ${goal.notes} ${goal.status}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const activeRank = (goal: GoalItem) => (goal.status === 'active' ? 0 : goal.status === 'paused' ? 1 : 2);
      return activeRank(a) - activeRank(b)
        || (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
        || a.title.localeCompare(b.title);
    });
};

const visualForTitle = (title: string): Pick<GoalItem, 'icon' | 'color'> => {
  const text = title.toLowerCase();
  if (text.includes('trip') || text.includes('travel') || text.includes('flight')) return { icon: 'plane', color: '#64B5F6' };
  if (text.includes('home') || text.includes('house')) return { icon: 'home', color: '#FFD54F' };
  if (text.includes('course') || text.includes('school') || text.includes('learn')) return { icon: 'graduation-cap', color: '#BA68C8' };
  if (text.includes('gift') || text.includes('holiday')) return { icon: 'gift', color: '#FFB87A' };
  if (text.includes('emergency') || text.includes('fund')) return { icon: 'piggy-bank', color: '#7ACB9C' };
  return { icon: 'target', color: '#FF8C94' };
};

const IconBadge = ({ goal, size = 'md' }: { goal: Pick<GoalItem, 'icon' | 'color'>; size?: 'sm' | 'md' | 'lg' }) => {
  const Icon = ICONS[goal.icon] || TargetIcon;
  const dims = size === 'lg' ? 'h-14 w-14 rounded-[20px]' : size === 'sm' ? 'h-9 w-9 rounded-[14px]' : 'h-11 w-11 rounded-[16px]';
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 17 : 20;

  return (
    <span
      className={`flex shrink-0 items-center justify-center ${dims} shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]`}
      style={{ backgroundColor: `${goal.color}26`, color: goal.color }}
    >
      <Icon size={iconSize} strokeWidth={2.7} />
    </span>
  );
};

const ProgressBar = ({ goal }: { goal: Pick<GoalItem, 'progress' | 'color' | 'status'> }) => {
  const color = goal.status === 'completed' || goal.progress >= 100 ? '#168B5E' : goal.color;
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#EFE4DA]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(goal.progress, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-12 text-right text-[13px] font-black text-[#536073]">{goal.progress}%</span>
    </div>
  );
};

export const Goals = () => {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [offlineRows, setOfflineRows] = useState<GoalItem[]>(normalizeSamples);
  const [summary, setSummary] = useState<GoalSummary>(() => computeSummary([]));
  const [statusFilter, setStatusFilter] = useState<GoalFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<GoalItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<GoalFormState>(emptyForm);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 240);

    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/goals', {
          params: {
            ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
            ...(search ? { search } : {}),
          },
        });
        if (!alive) return;
        const rows = asRecordArray(response.data?.goals).map(normalizeGoal);
        setGoals(rows);
        setSummary(normalizeSummary(response.data?.summary, rows));
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        const rows = applyLocalFilters(offlineRows, statusFilter, search);
        setGoals(rows);
        setSummary(computeSummary(rows));
        setOfflineMode(true);
        setError(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [offlineRows, reloadKey, search, statusFilter]);

  const topGoal = useMemo(
    () => [...goals].sort((a, b) => b.progress - a.progress || b.savedAmount - a.savedAmount)[0],
    [goals],
  );

  const closestGoal = useMemo(
    () =>
      goals
        .filter((goal) => goal.status !== 'completed' && goal.daysLeft !== null)
        .sort((a, b) => (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER))[0],
    [goals],
  );

  const refreshRemoteRows = async () => {
    const response = await api.get('/goals', {
      params: {
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      },
    });
    const rows = asRecordArray(response.data?.goals).map(normalizeGoal);
    setGoals(rows);
    setSummary(normalizeSummary(response.data?.summary, rows));
  };

  const refreshLocalRows = (nextRows: GoalItem[]) => {
    const rows = applyLocalFilters(nextRows, statusFilter, search);
    setGoals(rows);
    setSummary(computeSummary(rows));
  };

  const openCreateDrawer = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (goal: GoalItem) => {
    setEditing(goal);
    setForm({
      title: goal.title,
      targetAmount: String(goal.targetAmount),
      savedAmount: String(goal.savedAmount),
      targetDate: goal.targetDate,
      status: goal.status,
      icon: goal.icon,
      color: goal.color,
      notes: goal.notes,
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const handleTitleChange = (title: string) => {
    const visual = visualForTitle(title);
    setForm((current) => ({
      ...current,
      title,
      icon: current.icon === 'target' ? visual.icon : current.icon,
      color: current.color === '#FF8C94' ? visual.color : current.color,
    }));
  };

  const handleSave = async () => {
    const targetAmount = Number(form.targetAmount);
    const savedAmount = Number(form.savedAmount || 0);

    if (!form.title.trim()) {
      setFormError('Goal title is required.');
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setFormError('Target amount must be greater than 0.');
      return;
    }
    if (!Number.isFinite(savedAmount) || savedAmount < 0) {
      setFormError('Saved amount cannot be negative.');
      return;
    }
    if (form.targetDate && !form.targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setFormError('Target date is invalid.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      targetAmount,
      savedAmount,
      targetDate: form.targetDate || null,
      status: form.status,
      icon: form.icon,
      color: form.color,
      notes: form.notes.trim(),
    };

    setSaving(true);
    setFormError(null);

    try {
      if (offlineMode) {
        const nextGoal = normalizeGoal(
          {
            ...payload,
            id: editing?.id ?? `local-${Date.now()}`,
          },
          0,
        );
        const nextRows = editing
          ? offlineRows.map((goal) => (goal.id === editing.id ? nextGoal : goal))
          : [nextGoal, ...offlineRows];
        setOfflineRows(nextRows);
        refreshLocalRows(nextRows);
      } else if (editing) {
        await api.patch(`/goals/${editing.id}`, payload);
        await refreshRemoteRows();
      } else {
        await api.post('/goals', payload);
        await refreshRemoteRows();
      }

      setDrawerOpen(false);
      setEditing(null);
    } catch {
      setFormError('Could not save this goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (goal: GoalItem) => {
    const confirmed = window.confirm(`Delete "${goal.title}" goal?`);
    if (!confirmed) return;

    if (offlineMode) {
      const nextRows = offlineRows.filter((row) => row.id !== goal.id);
      setOfflineRows(nextRows);
      refreshLocalRows(nextRows);
      return;
    }

    try {
      await api.delete(`/goals/${goal.id}`);
      await refreshRemoteRows();
    } catch {
      setError('Could not delete this goal.');
    }
  };

  return (
    <div className="goals-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="flex flex-col gap-4 min-[1120px]:flex-row min-[1120px]:items-start min-[1120px]:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#FF7F96]">Growth</span>
            {offlineMode && (
              <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>
          <h2 className="text-[32px] font-black leading-tight tracking-tight text-[#2F2925]">Goals</h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">Track savings targets with clear milestones.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#2F2925] shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Refresh goals"
          >
            <RefreshCw size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.28)] transition hover:translate-y-[-1px] active:translate-y-0"
          >
            <Plus size={18} strokeWidth={3} />
            New Goal
          </button>
        </div>
      </div>

      <Card noPadding className="rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-4 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
        <div className="grid gap-3 min-[880px]:grid-cols-[220px_minmax(260px,1fr)_auto] min-[880px]:items-center">
          <label htmlFor="goal-status-filter" className="group relative block">
            <span className="sr-only">Goal status</span>
            <Filter className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
            <select
              id="goal-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as GoalFilter)}
              className="h-12 w-full appearance-none rounded-[16px] border border-[#EFE2D8] bg-white px-11 pr-9 text-[14px] font-black text-[#4E3629] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
            >
              <option value="all">All Goals</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8B929C]">⌄</span>
          </label>

          <label htmlFor="goal-search" className="relative block">
            <span className="sr-only">Search goals</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
            <input
              id="goal-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search goals, notes, status..."
              className="h-12 w-full rounded-full border border-[#EFE2D8] bg-white pl-11 pr-4 text-[14px] font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>

          <div className="rounded-[16px] bg-[#FFF8F2] px-4 py-3 text-sm font-black text-[#9D4E2B]">
            {loading ? 'Loading goals' : `${goals.length} shown`}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[1320px]:grid-cols-4">
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF0F2]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Total Target</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{money.format(summary.totalTarget)}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#FF7F96]">{summary.count} savings goals</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EAFBF1]" />
          <p className="relative z-[1] text-[13px] font-black text-[#168B5E]">Saved</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{money.format(summary.totalSaved)}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#55B978]">{summary.completed} completed</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF2E7]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Remaining</p>
          <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{money.format(summary.remaining)}</p>
          <p className="relative z-[1] mt-2 text-[11px] font-black text-[#9D4E2B]">{summary.active} active</p>
        </Card>
        <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
          <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EDF5FF]" />
          <p className="relative z-[1] text-[13px] font-black text-[#536073]">Overall Progress</p>
          <div className="relative z-[1] mt-6">
            <ProgressBar goal={{ progress: summary.progress, color: '#64B5F6', status: summary.progress >= 100 ? 'completed' : 'active' }} />
          </div>
        </Card>
      </div>

      {error && (
        <div className="rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-h-0 overflow-auto pr-1">
          {loading ? (
            <Card noPadding className="flex min-h-[340px] items-center justify-center rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
                <LoaderCircle className="animate-spin" size={16} />
                Loading goal shelf
              </div>
            </Card>
          ) : goals.length === 0 ? (
            <Card noPadding className="flex min-h-[340px] flex-col items-center justify-center rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-8 text-center shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <CuteSticker name="goals-cat" className="h-[142px] w-[162px]" title="Empty goals helper" />
              <p className="mt-2 text-lg font-black text-[#2F2925]">No goals found</p>
              <p className="mt-1 text-sm font-bold text-[#8B929C]">Create a target or adjust the filters.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-2 min-[1640px]:grid-cols-3">
              {goals.map((goal) => (
                <Card
                  key={goal.id}
                  noPadding
                  className="min-h-[268px] rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconBadge goal={goal} size="lg" />
                      <div className="min-w-0">
                        <h3 className="truncate text-[18px] font-black leading-tight text-[#2F2925]">{goal.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${statusClass(goal.status)}`}>
                            {statusLabel(goal.status)}
                          </span>
                          <span className="rounded-full bg-[#F7EFE8] px-2.5 py-1 text-[11px] font-black text-[#7B8491]">
                            {dueLabel(goal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(goal)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] transition hover:bg-[#FFF8F2] hover:text-[#2F2925]"
                        aria-label={`Edit ${goal.title}`}
                        title="Edit"
                      >
                        <Pencil size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(goal)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#F4D5DA] bg-white text-[#F27C8B] transition hover:bg-[#FFF0F2]"
                        aria-label={`Delete ${goal.title}`}
                        title="Delete"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 min-h-[40px] text-[13px] font-bold leading-relaxed text-[#6F7785]">{goal.notes || 'No notes yet.'}</p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[16px] bg-[#FAF6F0] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                      <p className="text-[11px] font-black uppercase text-[#8B929C]">Saved</p>
                      <p className="mt-1 truncate text-[16px] font-black text-[#2F2925]">{money.format(goal.savedAmount)}</p>
                    </div>
                    <div className="rounded-[16px] bg-[#FAF6F0] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                      <p className="text-[11px] font-black uppercase text-[#8B929C]">Target</p>
                      <p className="mt-1 truncate text-[16px] font-black text-[#2F2925]">{money.format(goal.targetAmount)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <ProgressBar goal={goal} />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-[12px] font-black text-[#8B929C]">
                    <span className="truncate">{readableDate(goal.targetDate)}</span>
                    <span className="shrink-0 text-[#FF7F96]">{money.format(goal.remaining)} left</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="hidden min-h-0 xl:block">
          <Card noPadding className="sticky top-0 rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="rounded-[20px] border border-[#F0DFD0] bg-[#FFF4E8] px-4 py-4 text-center">
              <CuteSticker
                name="goals-cat"
                className="mx-auto h-[132px] w-[150px] drop-shadow-[0_10px_16px_rgba(92,65,45,0.12)]"
                title="Goals helper"
              />
              <h3 className="mt-1 text-[17px] font-black text-[#2F2925]">Goal Buddy</h3>
              <p className="mt-1 text-[11px] font-bold leading-snug text-[#7B8491]">A tidy shelf for savings targets and deadlines.</p>
            </div>

            <div className="mt-3 grid gap-2.5">
              <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#7B8491]">Closest date</span>
                  <span className="rounded-full bg-[#FFD1DC] px-2 py-0.5 text-xs font-black text-[#4E3629]">{summary.dueSoon}</span>
                </div>
                <p className="mt-1.5 truncate text-lg font-black text-[#2F2925]">{closestGoal?.title || 'No deadlines'}</p>
                <p className="mt-1 text-[11px] font-bold text-[#8B929C]">{closestGoal ? dueLabel(closestGoal) : 'Add a target date'}</p>
              </div>

              <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#7B8491]">Top progress</span>
                  <span className="text-xs font-black text-[#55B978]">{topGoal?.progress || 0}%</span>
                </div>
                <p className="mt-1.5 truncate text-lg font-black text-[#2F2925]">{topGoal?.title || 'No goals yet'}</p>
              </div>

              <div className="rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#2F2925]">Saved coverage</p>
                  <p className="text-[11px] font-black text-[#F27C8B]">{summary.progress}%</p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EFE4DA]">
                  <div
                    className="h-full rounded-full bg-[#FF8C94]"
                    style={{ width: `${Math.min(summary.progress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-bold text-[#8B929C]">
                  {compactMoney.format(summary.totalSaved)} of {compactMoney.format(summary.totalTarget)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#4E3629]/20 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit goal' : 'New goal'}
            className="w-full max-w-[820px] rounded-t-[30px] border-x border-t border-[#EFE2D8] bg-[#FAF8F5] p-6 shadow-2xl animate-slide-up"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E8DCD0] pb-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-20 shrink-0 rounded-[22px] bg-[#FFF2E7] p-1.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]">
                  <CuteSticker name="goals-cat" className="h-full w-full" title="Goal helper" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[#FF7F96]">
                    <Sparkles size={13} strokeWidth={3} />
                    {editing ? 'Update Goal' : 'New Goal'}
                  </div>
                  <h3 className="mt-0.5 text-xl font-black text-[#2F2925]">
                    {editing ? 'Adjust this target' : 'Create a savings target'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2]"
                aria-label="Close goal form"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <div className="grid gap-4 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Status</span>
                <div className="grid grid-cols-3 gap-2 rounded-full border border-[#EFE2D8] bg-[#FFFDFB] p-1 shadow-inner">
                  {(['active', 'paused', 'completed'] as GoalStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, status }))}
                      className={`h-10 rounded-full text-sm font-black transition ${
                        form.status === status
                          ? status === 'completed'
                            ? 'bg-[#EAFBF1] text-[#168B5E] shadow-[0_6px_14px_rgba(22,155,97,0.12)]'
                            : status === 'paused'
                              ? 'bg-[#FFF2E7] text-[#9D4E2B] shadow-[0_6px_14px_rgba(157,78,43,0.12)]'
                              : 'bg-[#FFF0F2] text-[#F27C8B] shadow-[0_6px_14px_rgba(242,124,139,0.12)]'
                          : 'text-[#8B929C] hover:bg-[#FFF8F2]'
                      }`}
                    >
                      {statusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>

              <label htmlFor="goal-title" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Title</span>
                <input
                  id="goal-title"
                  value={form.title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  placeholder="Japan Trip, Emergency Fund..."
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <label htmlFor="goal-target-date" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Target Date</span>
                <div className="flex h-12 items-center rounded-[16px] border border-[#EFE2D8] bg-white px-4 focus-within:ring-4 focus-within:ring-[#FFD1DC]/40">
                  <CalendarDays size={17} strokeWidth={2.5} className="mr-2 text-[#8B929C]" />
                  <input
                    id="goal-target-date"
                    type="date"
                    value={form.targetDate}
                    onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-[#4E3629] outline-none"
                  />
                </div>
              </label>

              <label htmlFor="goal-target-amount" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Target Amount</span>
                <div className="flex h-12 items-center rounded-[16px] border border-[#EFE2D8] bg-white px-4 focus-within:ring-4 focus-within:ring-[#FFD1DC]/40">
                  <span className="mr-2 text-sm font-black text-[#8B929C]">$</span>
                  <input
                    id="goal-target-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.targetAmount}
                    onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
                    className="h-full w-full bg-transparent text-sm font-bold text-[#4E3629] outline-none"
                  />
                </div>
              </label>

              <label htmlFor="goal-saved-amount" className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Saved Amount</span>
                <div className="flex h-12 items-center rounded-[16px] border border-[#EFE2D8] bg-white px-4 focus-within:ring-4 focus-within:ring-[#FFD1DC]/40">
                  <span className="mr-2 text-sm font-black text-[#8B929C]">$</span>
                  <input
                    id="goal-saved-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.savedAmount}
                    onChange={(event) => setForm((current) => ({ ...current, savedAmount: event.target.value }))}
                    className="h-full w-full bg-transparent text-sm font-bold text-[#4E3629] outline-none"
                  />
                </div>
              </label>

              <label htmlFor="goal-notes" className="block md:col-span-2">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Notes</span>
                <input
                  id="goal-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Deposit schedule, reminder, or next milestone..."
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <div>
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Icon</span>
                <div className="grid grid-cols-5 gap-2">
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
                      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
                        {form.color === color && <Check size={15} strokeWidth={3} className="text-white drop-shadow" />}
                      </span>
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
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="h-11 cursor-pointer rounded-full border border-[#EFE2D8] bg-white px-5 text-sm font-black text-[#536073] transition hover:bg-[#FFF8F2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-6 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.24)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />}
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
