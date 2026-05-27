import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BriefcaseBusiness,
  Bus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
import { CuteSticker } from '../components/CuteStickers';
import { COLORS, fallbackColor, type ColorName } from '../constants/palette';
import { useAuthStore } from '../store/useAuthStore';
import { money } from '../utils/formatters';
import { userLabel } from '../utils/profile';
import { asRecord, asRecordArray, toNumber, type RawRecord } from '../utils/records';

type CategoryType = 'income' | 'expense' | 'both';
type CategoryTab = Extract<CategoryType, 'income' | 'expense'>;
type CategoryFilter = 'all' | CategoryType;
type CategoryScope = 'all' | 'default' | 'custom';
type ActivityFilter = 'all' | 'active' | 'unused';

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
  monthlyBudget: number;
}

interface CategoryFormState {
  name: string;
  type: CategoryType;
  icon: IconName;
  color: ColorName;
  description: string;
}

interface CategoryFilters {
  type: CategoryFilter;
  search: string;
}

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

const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  'Food & Dining': 600,
  Transport: 300,
  Shopping: 400,
  Entertainment: 200,
  'Bills & Utilities': 600,
  'Health & Fitness': 200,
  Others: 100,
  Salary: 5200,
  Freelance: 900,
  Investments: 500,
  Gifts: 250,
};

const defaultBudgetFor = (name: string, type: CategoryType, amount: number) => {
  const knownBudget = DEFAULT_CATEGORY_BUDGETS[name];
  if (knownBudget) return knownBudget;

  const base = Math.max(100, Math.ceil(Math.max(amount, 1) / 100) * 100);
  return type === 'income' ? Math.max(base, Math.ceil(base * 1.1)) : base;
};

const SAMPLE_CATEGORIES: CategoryItem[] = [
  {
    id: 'sample-food',
    name: 'Food & Dining',
    type: 'expense',
    icon: 'utensils',
    color: '#FFB87A',
    description: 'Meals, snacks, coffee, and groceries.',
    isDefault: true,
    usageCount: 24,
    transactionCount: 24,
    incomeTotal: 0,
    expenseTotal: 465.05,
    totalAmount: 465.05,
    monthlyBudget: 600,
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
    monthlyBudget: 300,
  },
  {
    id: 'sample-shopping',
    name: 'Shopping',
    type: 'expense',
    icon: 'shopping-bag',
    color: '#FFB87A',
    description: 'Clothes, home items, and online orders.',
    isDefault: true,
    usageCount: 18,
    transactionCount: 18,
    incomeTotal: 0,
    expenseTotal: 264.08,
    totalAmount: 264.08,
    monthlyBudget: 400,
  },
  {
    id: 'sample-entertainment',
    name: 'Entertainment',
    type: 'expense',
    icon: 'wallet',
    color: '#4DB6AC',
    description: 'Movies, games, shows, and little treats.',
    isDefault: true,
    usageCount: 8,
    transactionCount: 8,
    incomeTotal: 0,
    expenseTotal: 124.2,
    totalAmount: 124.2,
    monthlyBudget: 200,
  },
  {
    id: 'sample-bills',
    name: 'Bills & Utilities',
    type: 'expense',
    icon: 'receipt',
    color: '#8C9EFF',
    description: 'Rent, utilities, subscriptions, and recurring bills.',
    isDefault: true,
    usageCount: 10,
    transactionCount: 10,
    incomeTotal: 0,
    expenseTotal: 410,
    totalAmount: 410,
    monthlyBudget: 600,
  },
  {
    id: 'sample-health',
    name: 'Health & Fitness',
    type: 'expense',
    icon: 'heart-pulse',
    color: '#64B5F6',
    description: 'Care, medication, gym, and wellness spending.',
    isDefault: true,
    usageCount: 6,
    transactionCount: 6,
    incomeTotal: 0,
    expenseTotal: 72.3,
    totalAmount: 72.3,
    monthlyBudget: 200,
  },
  {
    id: 'sample-others',
    name: 'Others',
    type: 'expense',
    icon: 'more-horizontal',
    color: '#A1887F',
    description: 'Unsorted items that need a tidy home.',
    isDefault: true,
    usageCount: 3,
    transactionCount: 3,
    incomeTotal: 0,
    expenseTotal: 16.42,
    totalAmount: 16.42,
    monthlyBudget: 100,
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
    monthlyBudget: 5200,
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
    monthlyBudget: 900,
  },
  {
    id: 'sample-investments',
    name: 'Investments',
    type: 'income',
    icon: 'wallet',
    color: '#4DB6AC',
    description: 'Dividends, interest, and portfolio income.',
    isDefault: false,
    usageCount: 2,
    transactionCount: 2,
    incomeTotal: 320,
    expenseTotal: 0,
    totalAmount: 320,
    monthlyBudget: 500,
  },
  {
    id: 'sample-gifts',
    name: 'Gifts',
    type: 'income',
    icon: 'gift',
    color: '#BA68C8',
    description: 'Cash gifts, reimbursements, and one-off inflows.',
    isDefault: true,
    usageCount: 1,
    transactionCount: 1,
    incomeTotal: 120,
    expenseTotal: 0,
    totalAmount: 120,
    monthlyBudget: 250,
  },
];

const fallbackIcon = (value: unknown): IconName =>
  typeof value === 'string' && value in ICONS ? (value as IconName) : 'tag';

const normalizeCategory = (raw: RawRecord, index: number): CategoryItem => {
  const transactionCount = toNumber(raw.transaction_count ?? raw.transactionCount ?? raw.usage_count ?? raw.usageCount);
  const incomeTotal = toNumber(raw.income_total ?? raw.incomeTotal);
  const expenseTotal = toNumber(raw.expense_total ?? raw.expenseTotal);
  const totalAmount = toNumber(raw.total_amount ?? raw.totalAmount, incomeTotal + expenseTotal);
  const type = raw.type === 'income' || raw.type === 'both' ? raw.type : 'expense';
  const name = String(raw.name || 'Untitled Category');

  return {
    id: String(raw.id ?? `local-${index}`),
    name,
    type,
    icon: fallbackIcon(raw.icon),
    color: fallbackColor(raw.color),
    description: String(raw.description || 'No notes yet.'),
    isDefault: Boolean(raw.is_default ?? raw.isDefault),
    usageCount: toNumber(raw.usage_count ?? raw.usageCount, transactionCount),
    transactionCount,
    incomeTotal,
    expenseTotal,
    totalAmount,
    monthlyBudget: toNumber(
      raw.monthly_budget ?? raw.monthlyBudget ?? raw.budget ?? raw.budgetAmount ?? raw.limit ?? raw.target ?? raw.targetAmount,
      defaultBudgetFor(name, type, totalAmount),
    ),
  };
};

const normalizeCategoryResponse = (data: unknown) =>
  asRecordArray(asRecord(data).categories).map(normalizeCategory);

const categoryParams = (filters: CategoryFilters) => ({
  ...(filters.type !== 'all' ? { type: filters.type } : {}),
  ...(filters.search ? { search: filters.search } : {}),
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

const getCategoryAmount = (category: CategoryItem, activeTab: CategoryTab) =>
  activeTab === 'income' ? category.incomeTotal : category.expenseTotal;

const getProgressPercent = (amount: number, budget: number) => {
  if (!budget) return 0;
  return Math.round((amount / budget) * 100);
};

const firstNameFrom = (label: string) => label.trim().split(/[\s@]+/)[0] || 'Sarah';

const IconBadge = ({ category }: { category: Pick<CategoryItem, 'icon' | 'color'> }) => {
  const Icon = ICONS[category.icon] || Tag;

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] shadow-[inset_0_0_0_1px_rgba(34,45,66,0.06)]"
      style={{ backgroundColor: `${category.color}28`, color: category.color }}
    >
      <Icon size={18} strokeWidth={2.5} />
    </span>
  );
};

const TypePill = ({ type }: { type: CategoryType }) => {
  const styles = {
    expense: 'bg-[#FFF0EF] text-[#FF5B6F]',
    income: 'bg-[#EAFBF1] text-[#169B61]',
    both: 'bg-[#FFF2E7] text-[#9D4E2B]',
  };

  return (
    <span className={`inline-flex rounded-[9px] px-3 py-1 text-[13px] font-extrabold leading-none ${styles[type]}`}>
      {type === 'both' ? 'Shared' : type === 'income' ? 'Income' : 'Expense'}
    </span>
  );
};

const SelectField = ({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <label className="relative block w-full sm:w-[204px]">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full appearance-none rounded-[12px] border border-[#E5E2DF] bg-white px-4 pr-10 text-[15px] font-extrabold text-[#222B3A] outline-none transition focus:border-[#FF7D8F] focus:ring-4 focus:ring-[#FFE4E9]"
    >
      {children}
    </select>
    <ChevronDown
      size={16}
      strokeWidth={2.7}
      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6F7785]"
    />
  </label>
);

export const Categories = () => {
  const user = useAuthStore((state) => state.user);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [offlineRows, setOfflineRows] = useState<CategoryItem[]>(SAMPLE_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CategoryTab>('expense');
  const [categoryScope, setCategoryScope] = useState<CategoryScope>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const filters = useMemo<CategoryFilters>(() => ({ type: activeTab, search }), [activeTab, search]);
  const displayName = firstNameFrom(userLabel(user, 'Sarah'));

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
          params: categoryParams(filters),
        });
        if (!alive) return;
        setCategories(normalizeCategoryResponse(response.data));
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        setCategories(applyLocalFilters(offlineRows, filters.type, filters.search));
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
  }, [filters, offlineRows]);

  const visibleCategories = useMemo(
    () =>
      categories
        .filter((category) => {
          if (categoryScope === 'default') return category.isDefault;
          if (categoryScope === 'custom') return !category.isDefault;
          return true;
        })
        .filter((category) => {
          if (activityFilter === 'active') return category.transactionCount > 0;
          if (activityFilter === 'unused') return category.transactionCount === 0;
          return true;
        }),
    [activityFilter, categories, categoryScope],
  );

  const refreshLocal = (nextRows: CategoryItem[]) => {
    setCategories(applyLocalFilters(nextRows, filters.type, filters.search));
  };

  const openCreateDrawer = () => {
    setEditing(null);
    setForm({ ...emptyForm(), type: activeTab });
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
          ? offlineRows.map((category) =>
              category.id === editing.id
                ? {
                    ...category,
                    ...payload,
                    monthlyBudget: category.monthlyBudget || defaultBudgetFor(payload.name, payload.type, category.totalAmount),
                  }
                : category,
            )
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
                monthlyBudget: defaultBudgetFor(payload.name, payload.type, 0),
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
          params: categoryParams(filters),
        });
        setCategories(normalizeCategoryResponse(response.data));
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

  const rangeStart = visibleCategories.length ? 1 : 0;
  const rangeEnd = visibleCategories.length;
  const metricHeaders =
    activeTab === 'income'
      ? { planned: 'Target', actual: 'Received' }
      : { planned: 'Budget', actual: 'Spent' };

  return (
    <div className="categories-page flex h-full min-h-0 flex-col text-[#222B3A]">
      <div className="relative flex min-h-[182px] flex-col border-b border-[#E8E3DF] pb-0">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[12px] font-black leading-none text-[#FF5B6F]">Hi</p>
            <h2 className="mt-2 text-[32px] font-black leading-tight text-[#1F2633]">
              Good morning, {displayName}!
            </h2>
            <p className="mt-3 text-[16px] font-bold text-[#3C4656]">Manage your income and expense categories.</p>
            {offlineMode && (
              <span className="mt-3 inline-flex rounded-full bg-[#FFF2E7] px-3 py-1 text-[12px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>

          <CuteSticker
            name="categories-cat"
            className="pointer-events-none hidden h-[86px] w-[150px] shrink-0 select-none transition-transform duration-200 lg:block max-[1180px]:-translate-x-8 max-[1080px]:hidden"
            title="Categories mascot"
          />

          <div className="relative flex shrink-0 items-center gap-6 pt-3">
            <button
              type="button"
              onClick={() => setSearchOpen((current) => !current)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#3C4656] transition hover:bg-white"
              aria-label="Search categories"
            >
              <Search size={23} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#3C4656] transition hover:bg-white"
              aria-label="Notifications"
            >
              <Bell size={22} strokeWidth={2.4} />
            </button>

            {searchOpen && (
              <label className="absolute right-0 top-14 z-20 block w-[320px] max-w-[calc(100vw-48px)]">
                <span className="sr-only">Search categories</span>
                <Search
                  size={17}
                  strokeWidth={2.5}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8992A1]"
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search categories"
                  className="h-12 w-full rounded-[16px] border border-[#E5E2DF] bg-white pl-11 pr-11 text-[14px] font-bold text-[#222B3A] shadow-[0_16px_32px_rgba(34,43,58,0.08)] outline-none focus:border-[#FF7D8F] focus:ring-4 focus:ring-[#FFE4E9]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setSearchOpen(false);
                  }}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8992A1] hover:bg-[#F8F2EC]"
                  aria-label="Close search"
                >
                  <X size={15} strokeWidth={2.7} />
                </button>
              </label>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-4 pt-8 min-[880px]:flex-row min-[880px]:items-end min-[880px]:justify-between">
          <div className="flex gap-8 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] min-[880px]:overflow-visible [&::-webkit-scrollbar]:hidden">
            {(['expense', 'income'] as CategoryTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative h-12 shrink-0 cursor-pointer px-1 text-[15px] font-black transition ${
                  activeTab === tab ? 'text-[#FF5B6F]' : 'text-[#222B3A] hover:text-[#FF5B6F]'
                }`}
              >
                {tab === 'expense' ? 'Expense Categories' : 'Income Categories'}
                {activeTab === tab && <span className="absolute inset-x-0 bottom-[-1px] h-[3px] rounded-full bg-[#FF6B7B]" />}
              </button>
            ))}
          </div>

          <button
            onClick={openCreateDrawer}
            className="flex h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#FF697F] to-[#FF8292] px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(255,105,127,0.24)] transition hover:translate-y-[-1px] active:translate-y-0 min-[880px]:mb-3 min-[880px]:w-auto"
          >
            <Plus size={18} strokeWidth={3} />
            Add Category
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-[14px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <SelectField
          label="Category scope"
          value={categoryScope}
          onChange={(value) => setCategoryScope(value as CategoryScope)}
        >
          <option value="all">All Categories</option>
          <option value="default">Default Categories</option>
          <option value="custom">Custom Categories</option>
        </SelectField>

        <SelectField
          label="Activity filter"
          value={activityFilter}
          onChange={(value) => setActivityFilter(value as ActivityFilter)}
        >
          <option value="all">All Types</option>
          <option value="active">In Use</option>
          <option value="unused">Unused</option>
        </SelectField>
      </div>

      <div className="mt-7 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-[#E8E3DF] bg-white shadow-[0_18px_36px_rgba(34,43,58,0.04)]">
        {loading ? (
          <div className="flex h-full min-h-[260px] items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
              <LoaderCircle className="animate-spin" size={16} />
              Loading categories
            </div>
          </div>
        ) : visibleCategories.length === 0 ? (
          <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <CuteSticker name="categories-cat" className="h-[108px] w-[148px]" title="Empty categories" />
            <p className="mt-4 text-lg font-black text-[#1F2633]">No categories found</p>
            <p className="mt-1 text-sm font-bold text-[#7C8491]">Try a softer filter or add a new category.</p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-[#E8E3DF]">
                    <th className="w-[22%] px-5 py-5 text-left text-[15px] font-black text-[#2B3443]">Category</th>
                    <th className="w-[14%] px-5 py-5 text-left text-[15px] font-black text-[#2B3443]">Type</th>
                    <th className="w-[13%] px-5 py-5 text-left text-[15px] font-black text-[#2B3443]">{metricHeaders.planned}</th>
                    <th className="w-[29%] px-5 py-5 text-left text-[15px] font-black text-[#2B3443]">{metricHeaders.actual}</th>
                    <th className="w-[13%] px-5 py-5 text-center text-[15px] font-black text-[#2B3443]">Transactions</th>
                    <th className="w-[9%] px-5 py-5 text-center text-[15px] font-black text-[#2B3443]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCategories.map((category) => {
                    const amount = getCategoryAmount(category, activeTab);
                    const progress = getProgressPercent(amount, category.monthlyBudget);
                    const barWidth = Math.min(100, Math.max(amount > 0 ? 4 : 0, progress));

                    return (
                      <tr key={category.id} className="border-b border-[#ECE8E3] last:border-b-0">
                        <td className="px-5 py-[21px]">
                          <div className="flex min-w-0 items-center gap-4">
                            <IconBadge category={category} />
                            <span className="truncate text-[15px] font-black text-[#202836]">{category.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-[21px]">
                          <TypePill type={category.type} />
                        </td>
                        <td className="px-5 py-[21px] text-[15px] font-black text-[#202836]">
                          {money.format(category.monthlyBudget)}
                        </td>
                        <td className="px-5 py-[21px]">
                          <div className="flex items-center gap-3">
                            <span className="w-[72px] shrink-0 text-[15px] font-black text-[#202836]">{money.format(amount)}</span>
                            <div className="h-2 w-[clamp(42px,7vw,118px)] shrink-0 overflow-hidden rounded-full bg-[#EEEDEB]">
                              <div className="h-full rounded-full bg-[#5FC47E]" style={{ width: `${barWidth}%` }} />
                            </div>
                            <span className="text-[14px] font-extrabold text-[#6F7785]">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-[21px] text-center text-[15px] font-black text-[#202836]">
                          {category.transactionCount}
                        </td>
                        <td className="px-5 py-[21px]">
                          <div className="flex items-center justify-center gap-6">
                            <button
                              onClick={() => openEditDrawer(category)}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#3C4656] transition hover:bg-[#F8F2EC]"
                              aria-label={`Edit ${category.name}`}
                              title="Edit"
                            >
                              <Pencil size={18} strokeWidth={2.4} />
                            </button>
                            <button
                              onClick={() => handleDelete(category)}
                              disabled={category.isDefault}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#FF4F61] transition hover:bg-[#FFF0F2] disabled:cursor-not-allowed disabled:opacity-45"
                              aria-label={`Delete ${category.name}`}
                              title={category.isDefault ? 'Protected default' : 'Delete'}
                            >
                              <Trash2 size={18} strokeWidth={2.4} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex shrink-0 flex-col gap-4 border-t border-[#E8E3DF] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15px] font-bold text-[#5C6675]">
                Showing {rangeStart} to {rangeEnd} of {visibleCategories.length} categories
              </p>
              <div className="flex items-center gap-2">
                <button className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-[9px] text-[#4A5565] opacity-65" aria-label="First page" disabled>
                  <ChevronsLeft size={17} strokeWidth={2.4} />
                </button>
                <button className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-[9px] text-[#4A5565] opacity-65" aria-label="Previous page" disabled>
                  <ChevronLeft size={17} strokeWidth={2.4} />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#FFF0EF] text-[15px] font-black text-[#FF5B6F]" aria-current="page">
                  1
                </button>
                <button className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-[9px] text-[#4A5565] opacity-65" aria-label="Next page" disabled>
                  <ChevronRight size={17} strokeWidth={2.4} />
                </button>
                <button className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-[9px] text-[#4A5565] opacity-65" aria-label="Last page" disabled>
                  <ChevronsRight size={17} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        )}
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
                    {editing ? 'Update Category' : 'New Category'}
                  </div>
                  <h3 className="mt-0.5 text-xl font-black text-[#2F2925]">
                    {editing ? 'Edit this category' : 'Add a category'}
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
                  placeholder="Subscriptions, Travel, Payroll..."
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] disabled:bg-[#F7EFE8] disabled:text-[#8B929C] focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Description</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What belongs in this category?"
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
