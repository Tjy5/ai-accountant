import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Check,
  Gift,
  GraduationCap,
  HeartHandshake,
  Home,
  LoaderCircle,
  MoreHorizontal,
  PiggyBank,
  Plane,
  Plus,
  Save,
  Search,
  Sparkles,
  Target as TargetIcon,
  Trash2,
  Wallet,
  X,
  Car,
  Shield,
  PieChart,
  Trophy,
  TrendingUp,
  Bell,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { COLORS, fallbackColor, type ColorName } from '../constants/palette';
import { money } from '../utils/formatters';
import { asRecord, asRecordArray, toNumber, type RawRecord } from '../utils/records';

type GoalStatus = 'active' | 'paused' | 'completed';
type GoalFilter = 'all' | GoalStatus;
type GoalSort = 'progress-desc' | 'progress-asc' | 'target-desc' | 'saved-desc' | 'default';
type Pace = 'complete' | 'open' | 'overdue' | 'due_soon' | 'steady';

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

interface GoalFilters {
  status: GoalFilter;
  search: string;
}

interface GoalListState {
  rows: GoalItem[];
  summary: GoalSummary;
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
  car: Car,
  shield: Shield,
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
  'car',
  'shield',
];

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

const fallbackIcon = (value: unknown): IconName =>
  typeof value === 'string' && value in ICONS ? (value as IconName) : 'target';

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

const statusLabel = (status: GoalStatus) => {
  if (status === 'completed') return 'Completed';
  if (status === 'paused') return 'Paused';
  return 'Active';
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
  const summary = goals.reduce(
    (next, goal) => {
      next.totalTarget += goal.targetAmount;
      next.totalSaved += goal.savedAmount;
      if (goal.status === 'active') next.active += 1;
      if (goal.status === 'completed' || goal.progress >= 100) next.completed += 1;
      if (goal.daysLeft !== null && goal.daysLeft >= 0 && goal.daysLeft <= 30) next.dueSoon += 1;
      return next;
    },
    { totalTarget: 0, totalSaved: 0, active: 0, completed: 0, dueSoon: 0 },
  );

  return {
    ...summary,
    remaining: Math.max(summary.totalTarget - summary.totalSaved, 0),
    progress: percent(summary.totalSaved, summary.totalTarget),
    count: goals.length,
  };
};

const normalizeSummary = (raw: unknown, goals: GoalItem[]): GoalSummary => {
  const data = asRecord(raw);
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

const goalParams = (filters: GoalFilters) => ({
  ...(filters.status !== 'all' ? { status: filters.status } : {}),
  ...(filters.search ? { search: filters.search } : {}),
});

const normalizeGoalResponse = (data: unknown): GoalListState => {
  const source = asRecord(data);
  const rows = asRecordArray(source.goals).map(normalizeGoal);
  return { rows, summary: normalizeSummary(source.summary, rows) };
};

const localGoalState = (goals: GoalItem[], filters: GoalFilters): GoalListState => {
  const rows = applyLocalFilters(goals, filters.status, filters.search);
  return { rows, summary: computeSummary(rows) };
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
  if (text.includes('car') || text.includes('vehicle') || text.includes('drive')) return { icon: 'car', color: '#FF8C94' };
  if (text.includes('emergency') || text.includes('shield') || text.includes('protect') || text.includes('secure')) return { icon: 'shield', color: '#7ACB9C' };
  if (text.includes('fund') || text.includes('saving') || text.includes('bank')) return { icon: 'piggy-bank', color: '#7ACB9C' };
  return { icon: 'target', color: '#FF8C94' };
};

const goalEmoji = (goal: Pick<GoalItem, 'icon' | 'title'>) => {
  const title = goal.title.toLowerCase();
  if (goal.icon === 'car' || title.includes('car') || title.includes('vehicle')) return '🚗';
  if (goal.icon === 'plane' || title.includes('trip') || title.includes('travel')) return '✈️';
  if (goal.icon === 'home' || title.includes('home') || title.includes('house')) return '🏠';
  if (goal.icon === 'graduation-cap' || title.includes('education') || title.includes('course')) return '🎓';
  if (goal.icon === 'shield' || title.includes('emergency') || title.includes('protect')) return '🛡️';
  if (goal.icon === 'gift') return '🎁';
  if (goal.icon === 'piggy-bank') return '💰';
  return '🎯';
};

const progressColor = (goal: GoalItem) => (goal.status === 'completed' || goal.progress >= 100 ? '#35B96F' : goal.color);


export const Goals = () => {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [offlineRows, setOfflineRows] = useState<GoalItem[]>(normalizeSamples);
  const [summary, setSummary] = useState<GoalSummary>(() => computeSummary([]));
  const [statusFilter] = useState<GoalFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<GoalItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<GoalFormState>(emptyForm);

  const [sortBy, setSortBy] = useState<GoalSort>('progress-desc');
  const [showSearch, setShowSearch] = useState(false);

  const filters = useMemo<GoalFilters>(() => ({ status: statusFilter, search }), [search, statusFilter]);
  const applyGoalState = useCallback((state: GoalListState) => {
    setGoals(state.rows);
    setSummary(state.summary);
  }, []);

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
          params: goalParams(filters),
        });
        if (!alive) return;
        applyGoalState(normalizeGoalResponse(response.data));
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        applyGoalState(localGoalState(offlineRows, filters));
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
  }, [applyGoalState, filters, offlineRows]);

  const sortedGoals = useMemo(() => {
    const list = [...goals];
    if (sortBy === 'progress-desc') {
      return list.sort((a, b) => b.progress - a.progress);
    }
    if (sortBy === 'progress-asc') {
      return list.sort((a, b) => a.progress - b.progress);
    }
    if (sortBy === 'target-desc') {
      return list.sort((a, b) => b.targetAmount - a.targetAmount);
    }
    if (sortBy === 'saved-desc') {
      return list.sort((a, b) => b.savedAmount - a.savedAmount);
    }
    return list.sort((a, b) => {
      const activeRank = (goal: GoalItem) => (goal.status === 'active' ? 0 : goal.status === 'paused' ? 1 : 2);
      return activeRank(a) - activeRank(b)
        || (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER)
        || a.title.localeCompare(b.title);
    });
  }, [goals, sortBy]);

  const refreshRemoteRows = async () => {
    const response = await api.get('/goals', {
      params: goalParams(filters),
    });
    applyGoalState(normalizeGoalResponse(response.data));
  };

  const refreshLocalRows = (nextRows: GoalItem[]) => {
    applyGoalState(localGoalState(nextRows, filters));
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
      setDrawerOpen(false);
      setEditing(null);
      return;
    }

    try {
      await api.delete(`/goals/${goal.id}`);
      await refreshRemoteRows();
      setDrawerOpen(false);
      setEditing(null);
    } catch {
      setError('Could not delete this goal.');
    }
  };

  const CircularProgress = ({ progress, color }: { progress: number; color: string }) => {
    const radius = 30;
    const strokeWidth = 7;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference;

    return (
      <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
        <svg className="h-full w-full -rotate-90">
          <circle
            cx="38"
            cy="38"
            r={radius}
            className="stroke-[#F6EDE7]"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="38"
            cy="38"
            r={radius}
            className="transition-all duration-300"
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[18px] font-black text-[#1F2430]">{progress}%</span>
      </div>
    );
  };

  return (
    <div className="goals-page management-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="relative flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[32px] font-black leading-tight tracking-tight text-[#2F2925] flex items-center gap-2">
            Goals <span className="text-[28px]">🎯</span>
          </h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">
            Set goals, track progress, and achieve financial freedom! ✨
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 text-[#1F2430]">
          <div className={`grid transition-all duration-300 ${showSearch ? 'w-44 opacity-100' : 'w-0 opacity-0'}`}>
            <div className="overflow-hidden">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search goals..."
                aria-label="Search goals"
                className="h-10 w-full rounded-full border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#111827] transition hover:bg-[#FFF0F2] hover:text-[#FF6F8F]"
            aria-label="Toggle search"
          >
            <Search size={27} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#111827] transition hover:bg-[#FFF0F2] hover:text-[#FF6F8F]"
            aria-label="Notifications"
          >
            <Bell size={27} strokeWidth={2.3} />
          </button>
        </div>
      </div>

      <section className="relative shrink-0 rounded-[24px] border border-[#EFE2D8] bg-white/95 p-5 shadow-[0_16px_34px_rgba(92,65,45,0.06)]">
        <div className="pointer-events-none absolute -top-[74px] right-[clamp(68px,13vw,260px)] z-10 hidden h-[104px] w-[178px] select-none min-[900px]:block">
          <CuteSticker name="hanging-cat" className="h-full w-full" title="Goals overview cat" />
        </div>

        <h3 className="mb-4 text-[21px] font-black leading-none text-[#1F2430]">Goals Overview</h3>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-h-[116px] items-center gap-4 rounded-[18px] border border-[#DDEDD0] bg-[#FBFFF4] p-5 shadow-[0_10px_22px_rgba(92,65,45,0.035)]">
            <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] bg-[#EDFBEF] text-[#23A35A] shadow-[inset_0_0_0_1px_rgba(35,163,90,0.08)]">
              <TargetIcon size={32} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-[#1F2430]">Total Goals</p>
              <p className="mt-1 text-[28px] font-black leading-none text-[#1F2430]">{summary.count}</p>
              <p className="mt-1.5 text-[13px] font-black text-[#169B61]">{summary.active} active goals</p>
            </div>
          </div>

          <div className="flex min-h-[116px] items-center gap-3 rounded-[18px] border border-[#D3E4F9] bg-[#F7FBFF] p-4 shadow-[0_10px_22px_rgba(92,65,45,0.035)]">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#E7F3FF] text-[#3198E8] shadow-[inset_0_0_0_1px_rgba(49,152,232,0.08)]">
              <PieChart size={31} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-[#1F2430]">Total Saved</p>
              <p className="mt-2 whitespace-nowrap text-[22px] font-black leading-none text-[#1F2430] min-[1400px]:text-[26px]">{money.format(summary.totalSaved)}</p>
            </div>
          </div>

          <div className="flex min-h-[116px] items-center gap-3 rounded-[18px] border border-[#F3D6BC] bg-[#FFF9F0] p-4 shadow-[0_10px_22px_rgba(92,65,45,0.035)]">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-[#FFF0D6] text-[#F5A623] shadow-[inset_0_0_0_1px_rgba(245,166,35,0.1)]">
              <Trophy size={31} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-[#1F2430]">Total Target</p>
              <p className="mt-2 whitespace-nowrap text-[22px] font-black leading-none text-[#1F2430] min-[1400px]:text-[26px]">{money.format(summary.totalTarget)}</p>
            </div>
          </div>

          <div className="flex min-h-[116px] flex-col justify-between gap-3 rounded-[18px] border border-[#EAD8F6] bg-[#FFF9FF] p-4 shadow-[0_10px_22px_rgba(92,65,45,0.035)]">
            <div className="flex items-center gap-3">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-[#F3E8FF] text-[#9B5BEA] shadow-[inset_0_0_0_1px_rgba(155,91,234,0.08)]">
                <TrendingUp size={31} strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold leading-tight text-[#1F2430] min-[1400px]:text-[16px]">Overall Progress</p>
                <p className="mt-1 text-[28px] font-black leading-none text-[#8E55D9]">{summary.progress}%</p>
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[#EFE6F6]">
              <div
                className="h-full rounded-full bg-[#A363EC] transition-all"
                style={{ width: `${Math.min(summary.progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="shrink-0 rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
          {error}
        </div>
      )}

      <Card noPadding className="relative flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-[24px] border border-[#EFE2D8] bg-white/95 p-5 shadow-[0_16px_34px_rgba(92,65,45,0.06)]">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-[22px] font-black text-[#1F2430]">My Goals</h3>

          <label htmlFor="goal-sort" className="relative block w-full sm:w-auto">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#7C6E65]">Sort by:</span>
            <select
              id="goal-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as GoalSort)}
              className="h-11 w-full appearance-none rounded-full border border-[#EFE2D8] bg-white pl-[88px] pr-11 text-[14px] font-bold text-[#1F2430] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40 sm:min-w-[284px]"
            >
              <option value="progress-desc">Progress (High to Low)</option>
              <option value="progress-asc">Progress (Low to High)</option>
              <option value="target-desc">Target (High to Low)</option>
              <option value="saved-desc">Saved (High to Low)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#4E3629]" size={18} strokeWidth={2.6} />
          </label>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex h-full min-h-[260px] items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
                <LoaderCircle className="animate-spin" size={16} />
                Loading savings shelf...
              </div>
            </div>
          ) : sortedGoals.length === 0 ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <CuteSticker name="goals-cat" className="h-32 w-36" title="Empty goals helper" />
              <p className="mt-3 text-lg font-black text-[#2F2925]">No goals found</p>
              <p className="mt-1 text-sm font-bold text-[#8B929C]">Try adding a new target or adjusting filters!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sortedGoals.map((goal) => {
                const Icon = ICONS[goal.icon] || TargetIcon;
                const tone = progressColor(goal);
                return (
                  <div
                    key={goal.id}
                    onClick={() => openEditDrawer(goal)}
                    className="grid cursor-pointer gap-4 rounded-[20px] border border-[#F0E4D8] bg-white px-3.5 py-3 transition hover:border-[#FFB87A]/45 hover:shadow-[0_10px_24px_rgba(92,65,45,0.06)] md:grid-cols-[minmax(0,1.1fr)_minmax(230px,0.9fr)_76px_24px] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-[18px] shadow-[inset_0_0_0_1px_rgba(92,65,45,0.06)]"
                        style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
                      >
                        <Icon size={40} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="flex min-w-0 flex-wrap items-center gap-2 text-[21px] font-black leading-tight text-[#1F2430]">
                          <span className="truncate">{goal.title}</span>
                          <span className="text-[18px] leading-none">{goalEmoji(goal)}</span>
                          {goal.status === 'paused' && (
                            <span className="rounded-full bg-[#FFF2E7] px-2 py-0.5 text-[10px] font-black uppercase text-[#9D4E2B]">
                              Paused
                            </span>
                          )}
                          {goal.status === 'completed' && (
                            <span className="rounded-full bg-[#EAFBF1] px-2 py-0.5 text-[10px] font-black uppercase text-[#168B5E]">
                              Completed
                            </span>
                          )}
                        </h4>
                        <p className="mt-1 truncate text-[14px] font-bold text-[#5F6570]">
                          {goal.notes || 'No description yet.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate text-[22px] font-black leading-none text-[#1F2430]">
                          {money.format(goal.savedAmount)}
                        </span>
                        <span className="shrink-0 text-[16px] font-bold text-[#4F5866]">
                          / {money.format(goal.targetAmount)}
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-[#F3EAE3]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(goal.progress, 100)}%`,
                            backgroundColor: tone,
                          }}
                        />
                      </div>
                    </div>

                    <CircularProgress
                      progress={goal.progress}
                      color={tone}
                    />

                    <div className="flex items-center justify-end text-[#343A46]">
                      <ChevronRight size={26} strokeWidth={2.8} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative mt-5 shrink-0 pr-[78px] sm:pr-[96px]">
          <div className="pointer-events-none absolute -left-1 bottom-[-6px] z-[1] hidden h-[72px] w-[88px] select-none sm:block">
            <CuteSticker name="goals-cat" className="h-full w-full" title="Goals Cat" />
          </div>
          <div className="min-h-[56px] rounded-full border border-[#F5E7D8] bg-[#FFF9F1] px-6 py-4 text-[15px] font-bold text-[#7A6B61] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:ml-[86px]">
            <span className="font-black text-[#8C5B3D]">Tip:</span> Consistent saving today builds your better tomorrow! 💗
          </div>

          <button
            type="button"
            onClick={openCreateDrawer}
            className="absolute bottom-0 right-0 flex h-[72px] w-[72px] cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#FF6F8F] to-[#FF7E95] text-white shadow-[0_16px_28px_rgba(255,111,143,0.34)] transition hover:scale-105 active:scale-95"
            aria-label="Add new goal"
          >
            <Plus size={36} strokeWidth={3} />
          </button>
        </div>
      </Card>

      {/* Edit / Add Drawer Modal */}
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
              <div className="flex items-center gap-2">
                {editing && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editing)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#F4D5DA] bg-white text-[#F27C8B] transition hover:bg-[#FFF0F2] mr-1"
                    title="Delete Goal"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2]"
                  aria-label="Close goal form"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
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
                      className={`h-10 rounded-full text-sm font-black transition cursor-pointer ${
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
                <div className="grid grid-cols-6 gap-2">
                  {ICON_OPTIONS.map((icon) => {
                    const Icon = ICONS[icon] || TargetIcon;
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
                      <span className="flex h-7 w-7 items-center justify-center rounded-full cursor-pointer" style={{ backgroundColor: color }}>
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
