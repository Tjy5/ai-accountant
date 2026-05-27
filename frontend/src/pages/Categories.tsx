import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BriefcaseBusiness,
  Bus,
  Check,
  Filter,
  Gamepad2,
  Gift,
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
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';

type CategoryType = 'income' | 'expense' | 'both';
type CategoryFilter = 'all' | CategoryType;

interface CategoryItem {
  id: string;
  name: string;
  type: CategoryType;
  icon: IconName;
  color: ColorName;
  description: string;
  isDefault: boolean;
  usageCount: number;
  transactionCount: number;
  incomeTotal: number;
  expenseTotal: number;
  totalAmount: number;
}

interface CategoryFormState {
  name: string;
  type: CategoryType;
  icon: IconName;
  color: ColorName;
  description: string;
}

interface CategoryStats {
  total: number;
  expense: number;
  income: number;
  both: number;
  custom: number;
  default: number;
  transactions: number;
  trackedSpend: number;
}

type RawCategory = {
  id?: string | number;
  name?: string;
  type?: string;
  icon?: string;
  color?: string;
  description?: string;
  is_default?: boolean;
  isDefault?: boolean;
  usage_count?: number | string;
  usageCount?: number | string;
  transaction_count?: number | string;
  transactionCount?: number | string;
  income_total?: number | string;
  incomeTotal?: number | string;
  expense_total?: number | string;
  expenseTotal?: number | string;
  total_amount?: number | string;
  totalAmount?: number | string;
};

const ICONS = {
  utensils: Utensils,
  bus: Bus,
  'shopping-bag': ShoppingBag,
  gamepad: Gamepad2,
  receipt: ReceiptText,
  'heart-pulse': HeartPulse,
  wallet: Wallet,
  briefcase: BriefcaseBusiness,
  gift: Gift,
  sparkles: Sparkles,
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
  'briefcase',
  'gift',
  'sparkles',
  'tag',
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

const SAMPLE_CATEGORIES: CategoryItem[] = [
  {
    id: 'sample-food',
    name: 'Food & Dining',
    type: 'expense',
    icon: 'utensils',
    color: '#FF8C94',
    description: 'Meals, snacks, coffee, and groceries.',
    isDefault: true,
    usageCount: 24,
    transactionCount: 24,
    incomeTotal: 0,
    expenseTotal: 465.05,
    totalAmount: 465.05,
  },
  {
    id: 'sample-transport',
    name: 'Transport',
    type: 'expense',
    icon: 'bus',
    color: '#64B5F6',
    description: 'Transit, rideshare, fuel, and parking.',
    isDefault: true,
    usageCount: 12,
    transactionCount: 12,
    incomeTotal: 0,
    expenseTotal: 216.05,
    totalAmount: 216.05,
  },
  {
    id: 'sample-shopping',
    name: 'Shopping',
    type: 'expense',
    icon: 'shopping-bag',
    color: '#FFD54F',
    description: 'Clothes, home items, and online orders.',
    isDefault: true,
    usageCount: 18,
    transactionCount: 18,
    incomeTotal: 0,
    expenseTotal: 264.08,
    totalAmount: 264.08,
  },
  {
    id: 'sample-entertainment',
    name: 'Entertainment',
    type: 'expense',
    icon: 'gamepad',
    color: '#BA68C8',
    description: 'Movies, games, shows, and little treats.',
    isDefault: false,
    usageCount: 8,
    transactionCount: 8,
    incomeTotal: 0,
    expenseTotal: 124.2,
    totalAmount: 124.2,
  },
  {
    id: 'sample-salary',
    name: 'Salary',
    type: 'income',
    icon: 'briefcase',
    color: '#7ACB9C',
    description: 'Primary paycheck and payroll deposits.',
    isDefault: true,
    usageCount: 2,
    transactionCount: 2,
    incomeTotal: 5200,
    expenseTotal: 0,
    totalAmount: 5200,
  },
  {
    id: 'sample-freelance',
    name: 'Freelance',
    type: 'income',
    icon: 'sparkles',
    color: '#FFB87A',
    description: 'Client work and side project income.',
    isDefault: false,
    usageCount: 3,
    transactionCount: 3,
    incomeTotal: 840,
    expenseTotal: 0,
    totalAmount: 840,
  },
  {
    id: 'sample-other',
    name: 'Other',
    type: 'both',
    icon: 'more-horizontal',
    color: '#A1887F',
    description: 'Unsorted items that need a cozy home.',
    isDefault: true,
    usageCount: 3,
    transactionCount: 3,
    incomeTotal: 30,
    expenseTotal: 16.42,
    totalAmount: 46.42,
  },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fallbackColor = (value?: string): ColorName => (COLORS.includes(value as ColorName) ? (value as ColorName) : '#FF8C94');
const fallbackIcon = (value?: string): IconName => (value && value in ICONS ? (value as IconName) : 'tag');

const normalizeCategory = (raw: RawCategory, index: number): CategoryItem => {
  const transactionCount = Number(raw?.transaction_count ?? raw?.transactionCount ?? raw?.usage_count ?? raw?.usageCount ?? 0);
  const incomeTotal = Number(raw?.income_total ?? raw?.incomeTotal ?? 0);
  const expenseTotal = Number(raw?.expense_total ?? raw?.expenseTotal ?? 0);
  const totalAmount = Number(raw?.total_amount ?? raw?.totalAmount ?? incomeTotal + expenseTotal);
  const type = raw?.type === 'income' || raw?.type === 'both' ? raw.type : 'expense';

  return {
    id: String(raw?.id ?? `local-${index}`),
    name: String(raw?.name || 'Untitled Category'),
    type,
    icon: fallbackIcon(raw?.icon),
    color: fallbackColor(raw?.color),
    description: String(raw?.description || 'No notes yet.'),
    isDefault: Boolean(raw?.is_default ?? raw?.isDefault),
    usageCount: Number(raw?.usage_count ?? raw?.usageCount ?? transactionCount),
    transactionCount,
    incomeTotal,
    expenseTotal,
    totalAmount,
  };
};

const computeStats = (categories: CategoryItem[]): CategoryStats => ({
  total: categories.length,
  expense: categories.filter((category) => category.type === 'expense').length,
  income: categories.filter((category) => category.type === 'income').length,
  both: categories.filter((category) => category.type === 'both').length,
  custom: categories.filter((category) => !category.isDefault).length,
  default: categories.filter((category) => category.isDefault).length,
  transactions: categories.reduce((sum, category) => sum + category.transactionCount, 0),
  trackedSpend: categories.reduce((sum, category) => sum + category.expenseTotal, 0),
});

const applyLocalFilters = (categories: CategoryItem[], typeFilter: CategoryFilter, search: string) => {
  const query = search.trim().toLowerCase();
  return categories
    .filter((category) => typeFilter === 'all' || category.type === typeFilter || category.type === 'both')
    .filter((category) => {
      if (!query) return true;
      return `${category.name} ${category.description} ${category.type}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const rank = (type: CategoryType) => (type === 'expense' ? 0 : type === 'income' ? 1 : 2);
      return rank(a.type) - rank(b.type) || a.name.localeCompare(b.name);
    });
};

const emptyForm = (): CategoryFormState => ({
  name: '',
  type: 'expense',
  icon: 'tag',
  color: '#FF8C94',
  description: '',
});

const IconBadge = ({ category, size = 'md' }: { category: Pick<CategoryItem, 'icon' | 'color'>; size?: 'sm' | 'md' | 'lg' }) => {
  const Icon = ICONS[category.icon] || Tag;
  const dims = size === 'lg' ? 'h-14 w-14 rounded-[20px]' : size === 'sm' ? 'h-9 w-9 rounded-[14px]' : 'h-11 w-11 rounded-[16px]';
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 17 : 20;

  return (
    <span
      className={`flex shrink-0 items-center justify-center ${dims} shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]`}
      style={{ backgroundColor: `${category.color}26`, color: category.color }}
    >
      <Icon size={iconSize} strokeWidth={2.7} />
    </span>
  );
};

const TypePill = ({ type }: { type: CategoryType }) => {
  const styles = {
    expense: 'bg-[#FFF0F2] text-[#F27C8B]',
    income: 'bg-[#EAFBF1] text-[#169B61]',
    both: 'bg-[#FFF2E7] text-[#9D4E2B]',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${styles[type]}`}>
      {type === 'both' ? 'Shared' : type}
    </span>
  );
};

export const Categories = () => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [offlineRows, setOfflineRows] = useState<CategoryItem[]>(SAMPLE_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<CategoryFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);

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
        const response = await api.get('/categories', {
          params: {
            ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
            ...(search ? { search } : {}),
          },
        });
        if (!alive) return;
        const rawCategories: RawCategory[] = Array.isArray(response.data?.categories) ? response.data.categories : [];
        const rows = rawCategories.map(normalizeCategory);
        setCategories(rows);
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        setCategories(applyLocalFilters(offlineRows, typeFilter, search));
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
  }, [offlineRows, search, typeFilter]);

  const stats = useMemo(() => computeStats(categories), [categories]);
  const maxAmount = useMemo(() => Math.max(1, ...categories.map((category) => category.totalAmount)), [categories]);
  const topCategory = useMemo(
    () => [...categories].sort((a, b) => b.transactionCount - a.transactionCount || b.totalAmount - a.totalAmount)[0],
    [categories],
  );

  const refreshLocal = (nextRows: CategoryItem[]) => {
    setCategories(applyLocalFilters(nextRows, typeFilter, search));
  };

  const openCreateDrawer = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (category: CategoryItem) => {
    setEditing(category);
    setForm({
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      description: category.description,
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      icon: form.icon,
      color: form.color,
      description: form.description.trim(),
    };

    try {
      if (offlineMode) {
        const nextRows = editing
          ? offlineRows.map((category) => (category.id === editing.id ? { ...category, ...payload } : category))
          : [
              {
                ...payload,
                id: `local-${Date.now()}`,
                isDefault: false,
                usageCount: 0,
                transactionCount: 0,
                incomeTotal: 0,
                expenseTotal: 0,
                totalAmount: 0,
              },
              ...offlineRows,
            ];
        setOfflineRows(nextRows);
        refreshLocal(nextRows);
      } else if (editing) {
        await api.patch(`/categories/${editing.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }

      setDrawerOpen(false);
      setEditing(null);
      if (!offlineMode) {
        const response = await api.get('/categories', {
          params: {
            ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
            ...(search ? { search } : {}),
          },
        });
        const rawCategories: RawCategory[] = Array.isArray(response.data?.categories) ? response.data.categories : [];
        const rows = rawCategories.map(normalizeCategory);
        setCategories(rows);
      }
    } catch {
      setFormError('Could not save this category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: CategoryItem) => {
    if (category.isDefault) {
      setError('Default categories are protected.');
      return;
    }
    const confirmed = window.confirm(`Delete "${category.name}"?`);
    if (!confirmed) return;

    if (offlineMode) {
      const nextRows = offlineRows.filter((row) => row.id !== category.id);
      setOfflineRows(nextRows);
      refreshLocal(nextRows);
      return;
    }

    try {
      await api.delete(`/categories/${category.id}`);
      setCategories((current) => current.filter((row) => row.id !== category.id));
    } catch {
      setError('Could not delete this category.');
    }
  };

  return (
    <div className="categories-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#FF7F96]">Library</span>
            {offlineMode && (
              <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>
          <h2 className="text-[32px] font-black leading-tight text-[#2F2925]">Categories</h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">Shape the labels that keep every entry tidy.</p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Search categories"
          >
            <Search size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Notifications"
          >
            <Bell size={19} strokeWidth={2.5} className="text-[#2F2925]" />
          </button>
        </div>
      </div>

      <div className="relative">
        <CuteSticker
          name="categories-cat"
          className="pointer-events-none absolute right-[7%] top-[-88px] z-10 hidden h-[126px] w-[158px] select-none drop-shadow-[0_10px_14px_rgba(92,65,45,0.14)] xl:block"
          title="Categories helper cat"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF0F2]" />
            <p className="relative z-[1] text-[13px] font-black text-[#536073]">Total Labels</p>
            <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{stats.total}</p>
            <p className="relative z-[1] mt-2 text-[11px] font-black text-[#FF7F96]">{stats.custom} custom categories</p>
          </Card>
          <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EAFBF1]" />
            <p className="relative z-[1] text-[13px] font-black text-[#536073]">Income Labels</p>
            <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{stats.income}</p>
            <p className="relative z-[1] mt-2 text-[11px] font-black text-[#169B61]">{stats.both} shared labels</p>
          </Card>
          <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#FFF2E7]" />
            <p className="relative z-[1] text-[13px] font-black text-[#536073]">Expense Labels</p>
            <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{stats.expense}</p>
            <p className="relative z-[1] mt-2 text-[11px] font-black text-[#9D4E2B]">{money.format(stats.trackedSpend)} tracked</p>
          </Card>
          <Card noPadding className="relative min-h-[112px] overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="absolute -bottom-8 -right-8 h-[112px] w-[112px] rounded-full bg-[#EDF5FF]" />
            <p className="relative z-[1] text-[13px] font-black text-[#536073]">Tagged Entries</p>
            <p className="relative z-[1] mt-3 text-[29px] font-black leading-tight text-[#2F2925]">{stats.transactions}</p>
            <p className="relative z-[1] mt-2 text-[11px] font-black text-[#3575A8]">{stats.default} protected defaults</p>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(260px,420px)]">
          <label className="group relative block">
            <span className="sr-only">Category type</span>
            <Filter className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as CategoryFilter)}
              className="h-12 w-full appearance-none rounded-[16px] border border-[#EFE2D8] bg-[#FFFDFB] px-11 pr-9 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="both">Shared</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8B929C]">⌄</span>
          </label>

          <label className="relative block">
            <span className="sr-only">Search categories</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search labels, notes, type..."
              className="h-12 w-full rounded-full border border-[#EFE2D8] bg-[#FFFDFB] pl-11 pr-4 text-[14px] font-bold text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>
        </div>

        <button
          onClick={openCreateDrawer}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-6 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.28)] transition-all hover:translate-y-[-1px] active:translate-y-0 xl:w-auto"
        >
          <Plus size={19} strokeWidth={3} />
          Add Category
        </button>
      </div>

      {error && (
        <div className="rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-h-0 overflow-auto pr-1">
          {loading ? (
            <Card noPadding className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
                <LoaderCircle className="animate-spin" size={16} />
                Loading category shelf
              </div>
            </Card>
          ) : categories.length === 0 ? (
            <Card noPadding className="flex min-h-[320px] flex-col items-center justify-center rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-8 text-center shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
              <CuteSticker name="categories-cat" className="h-[116px] w-[146px]" title="Empty categories cat" />
              <p className="mt-2 text-lg font-black text-[#2F2925]">No categories found</p>
              <p className="mt-1 text-sm font-bold text-[#8B929C]">Try a softer filter or add a new label.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-2 min-[1700px]:grid-cols-3">
              {categories.map((category) => {
                const barWidth = Math.max(6, Math.round((category.totalAmount / maxAmount) * 100));
                const amountLabel = category.type === 'income' ? category.incomeTotal : category.type === 'expense' ? category.expenseTotal : category.totalAmount;
                return (
                  <Card
                    key={category.id}
                    noPadding
                    className="min-h-[216px] rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <IconBadge category={category} size="lg" />
                        <div className="min-w-0">
                          <h3 className="truncate text-[17px] font-black leading-tight text-[#2F2925]">{category.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <TypePill type={category.type} />
                            {category.isDefault && (
                              <span className="rounded-full bg-[#F7EFE8] px-2.5 py-1 text-[11px] font-black uppercase text-[#7B8491]">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => openEditDrawer(category)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] transition hover:bg-[#FFF8F2] hover:text-[#2F2925]"
                          aria-label={`Edit ${category.name}`}
                          title="Edit"
                        >
                          <Pencil size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          disabled={category.isDefault}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#F4D5DA] bg-white text-[#F27C8B] transition hover:bg-[#FFF0F2] disabled:cursor-not-allowed disabled:opacity-35"
                          aria-label={`Delete ${category.name}`}
                          title={category.isDefault ? 'Protected default' : 'Delete'}
                        >
                          <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <p className="mt-4 min-h-[40px] text-[13px] font-bold leading-relaxed text-[#6F7785]">{category.description}</p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-[16px] bg-[#FAF6F0] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                        <p className="text-[11px] font-black uppercase text-[#8B929C]">Amount</p>
                        <p className="mt-1 truncate text-[16px] font-black text-[#2F2925]">{money.format(amountLabel)}</p>
                      </div>
                      <div className="rounded-[16px] bg-[#FAF6F0] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                        <p className="text-[11px] font-black uppercase text-[#8B929C]">Entries</p>
                        <p className="mt-1 text-[16px] font-black text-[#2F2925]">{category.transactionCount}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-[#EFE4DA]">
                        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: category.color }} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden min-h-0 xl:block">
          <Card noPadding className="sticky top-0 rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] p-5 shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
            <div className="rounded-[20px] border border-[#F0DFD0] bg-[#FFF4E8] px-4 py-4 text-center">
              <CuteSticker
                name="categories-cat"
                className="mx-auto h-[100px] w-[132px] drop-shadow-[0_10px_16px_rgba(92,65,45,0.12)]"
                title="Category organizer"
              />
              <h3 className="mt-1 text-[17px] font-black text-[#2F2925]">Label Library</h3>
              <p className="mt-1 text-[11px] font-bold leading-snug text-[#7B8491]">A tidy set of labels makes AI drafts easier to confirm.</p>
            </div>

            <div className="mt-3 grid gap-2.5">
              <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#7B8491]">Most used</span>
                  <span className="rounded-full bg-[#FFD1DC] px-2 py-0.5 text-xs font-black text-[#4E3629]">{topCategory?.transactionCount || 0}</span>
                </div>
                <p className="mt-1.5 truncate text-lg font-black text-[#2F2925]">{topCategory?.name || 'No labels yet'}</p>
              </div>

              <div className="rounded-[18px] bg-[#FAF6F0] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#7B8491]">Protected</span>
                  <span className="text-xs font-black text-[#55B978]">{stats.default}</span>
                </div>
                <p className="mt-1.5 text-lg font-black text-[#2F2925]">{stats.default === 1 ? '1 default' : `${stats.default} defaults`}</p>
              </div>

              <div className="rounded-[18px] border border-[#F0DFD0] bg-[#FFF9F2] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-[#2F2925]">Expense coverage</p>
                  <p className="text-[11px] font-black text-[#F27C8B]">{stats.expense}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EFE4DA]">
                  <div
                    className="h-full rounded-full bg-[#FF8C94]"
                    style={{ width: `${stats.total ? Math.round((stats.expense / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#4E3629]/20 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit category' : 'New category'}
            className="w-full max-w-[760px] rounded-t-[30px] border-x border-t border-[#EFE2D8] bg-[#FAF8F5] p-6 shadow-2xl animate-slide-up"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E8DCD0] pb-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-20 shrink-0 rounded-[22px] bg-[#FFF2E7] p-1.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]">
                  <CuteSticker name="categories-cat" className="h-full w-full" title="Category helper" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[#FF7F96]">
                    <Sparkles size={13} strokeWidth={3} />
                    {editing ? 'Update Label' : 'New Label'}
                  </div>
                  <h3 className="mt-0.5 text-xl font-black text-[#2F2925]">
                    {editing ? 'Polish this category' : 'Add a category'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2]"
                aria-label="Close category form"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <div className="grid gap-4 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Type</span>
                <div className="grid grid-cols-3 gap-2 rounded-full border border-[#EFE2D8] bg-[#FFFDFB] p-1 shadow-inner">
                  {(['expense', 'income', 'both'] as CategoryType[]).map((type) => {
                    const disabled = Boolean(editing?.isDefault && type !== editing.type);
                    return (
                      <button
                        key={type}
                        onClick={() => setForm((current) => ({ ...current, type }))}
                        disabled={disabled}
                        className={`h-10 rounded-full text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          form.type === type
                            ? type === 'income'
                              ? 'bg-[#EAFBF1] text-[#169B61] shadow-[0_6px_14px_rgba(22,155,97,0.12)]'
                              : type === 'expense'
                                ? 'bg-[#FFF0F2] text-[#F27C8B] shadow-[0_6px_14px_rgba(242,124,139,0.12)]'
                                : 'bg-[#FFF2E7] text-[#9D4E2B] shadow-[0_6px_14px_rgba(157,78,43,0.12)]'
                            : 'text-[#8B929C] hover:bg-[#FFF8F2]'
                        }`}
                        type="button"
                      >
                        {type === 'both' ? 'Shared' : type === 'income' ? 'Income' : 'Expense'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={Boolean(editing?.isDefault)}
                  placeholder="Subscriptions, Pets, Travel..."
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] disabled:bg-[#F7EFE8] disabled:text-[#8B929C] focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Description</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What belongs in this label?"
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
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
