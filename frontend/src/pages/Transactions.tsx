import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { Card } from '../components/Card';
import { CuteSticker } from '../components/CuteStickers';
import { money, normalizeDateInput, readableInputDate, todayInput } from '../utils/formatters';
import { asRecord, asRecordArray, toNumber, type RawRecord } from '../utils/records';

type TransactionType = 'income' | 'expense';

interface TransactionItem {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  date: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface TotalsState {
  income: number;
  expense: number;
  net: number;
  count: number;
}

interface TransactionFormState {
  type: TransactionType;
  category: string;
  amount: string;
  description: string;
  date: string;
}

interface TransactionFilters {
  type: 'all' | TransactionType;
  category: string;
  search: string;
  startDate: string;
  endDate: string;
  page: number;
}

interface TransactionListState {
  rows: TransactionItem[];
  totals: TotalsState;
  pagination: PaginationState;
}

const PAGE_SIZE = 8;

const SAMPLE_TRANSACTIONS: TransactionItem[] = [
  { id: 'sample-1', type: 'expense', category: 'Food & Dining', amount: 6.5, description: 'Starbucks Coffee', date: '2024-10-28T00:00:00' },
  { id: 'sample-2', type: 'expense', category: 'Transport', amount: 2.2, description: 'Bus Fare', date: '2024-10-28T00:00:00' },
  { id: 'sample-3', type: 'income', category: 'Income', amount: 5200, description: 'Salary', date: '2024-10-26T00:00:00' },
  { id: 'sample-4', type: 'expense', category: 'Food & Dining', amount: 28.9, description: 'Pizza Night', date: '2024-10-25T00:00:00' },
  { id: 'sample-5', type: 'expense', category: 'Shopping', amount: 65.1, description: 'Online Shopping', date: '2024-10-25T00:00:00' },
  { id: 'sample-6', type: 'expense', category: 'Entertainment', amount: 34, description: 'Movie Tickets', date: '2024-10-24T00:00:00' },
  { id: 'sample-7', type: 'expense', category: 'Food & Dining', amount: 42.36, description: 'Grocery Store', date: '2024-10-24T00:00:00' },
  { id: 'sample-8', type: 'expense', category: 'Transport', amount: 35, description: 'Gas Station', date: '2024-10-23T00:00:00' },
];

const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Income',
  'Salary',
  '餐饮',
  '交通',
  '购物',
  '工资',
  '其他',
];

const normalizeTransaction = (raw: RawRecord, index: number): TransactionItem => ({
  id: String(raw?.id ?? `local-${index}`),
  type: raw?.type === 'income' ? 'income' : 'expense',
  category: String(raw?.category || 'Other'),
  amount: toNumber(raw?.amount),
  description: String(raw?.description || raw?.category || 'Untitled transaction'),
  date: String(raw?.date || todayInput()),
});

const categoryVisual = (transaction: Pick<TransactionItem, 'category' | 'description' | 'type'>) => {
  const text = `${transaction.category} ${transaction.description}`.toLowerCase();
  if (transaction.type === 'income' || text.includes('salary') || text.includes('工资')) {
    return { icon: '💵', bg: '#EAFBF1', text: '#169B61' };
  }
  if (text.includes('bus') || text.includes('transport') || text.includes('taxi') || text.includes('交通') || text.includes('gas')) {
    return { icon: '🚌', bg: '#EAF6FF', text: '#3575A8' };
  }
  if (text.includes('shopping') || text.includes('shop') || text.includes('购物')) {
    return { icon: '🛍️', bg: '#FFF0F2', text: '#F27C8B' };
  }
  if (text.includes('movie') || text.includes('entertainment')) {
    return { icon: '🎟️', bg: '#F7EAFB', text: '#9A63AE' };
  }
  if (text.includes('coffee') || text.includes('food') || text.includes('pizza') || text.includes('grocery') || text.includes('餐饮')) {
    return { icon: '🍴', bg: '#FFF2E7', text: '#9D4E2B' };
  }
  return { icon: '🧾', bg: '#F7EFE8', text: '#4E3629' };
};

const accountLabel = (transaction: TransactionItem) => {
  if (transaction.type === 'income') return 'Checking';
  if (/shopping|movie|entertainment/i.test(`${transaction.category} ${transaction.description}`)) return 'Credit Card';
  return 'Checking';
};

const computeTotals = (transactions: TransactionItem[]): TotalsState => {
  const totals = transactions.reduce(
    (next, transaction) => {
      if (transaction.type === 'income') {
        next.income += transaction.amount;
      } else {
        next.expense += transaction.amount;
      }
      return next;
    },
    { income: 0, expense: 0 },
  );

  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    count: transactions.length,
  };
};

const transactionParams = (filters: TransactionFilters, page = filters.page) => ({
  page,
  pageSize: PAGE_SIZE,
  ...(filters.search ? { search: filters.search } : {}),
  ...(filters.type !== 'all' ? { type: filters.type } : {}),
  ...(filters.category !== 'all' ? { category: filters.category } : {}),
  ...(filters.startDate ? { startDate: filters.startDate } : {}),
  ...(filters.endDate ? { endDate: filters.endDate } : {}),
});

const normalizeTransactionResponse = (data: unknown, fallbackPage: number): TransactionListState => {
  const source = asRecord(data);
  const rows = asRecordArray(source.transactions).map(normalizeTransaction);
  const totals = asRecord(source.totals);
  const pagination = asRecord(source.pagination);

  return {
    rows,
    totals: {
      income: toNumber(totals.income),
      expense: toNumber(totals.expense),
      net: toNumber(totals.net),
      count: toNumber(totals.count, rows.length),
    },
    pagination: {
      page: toNumber(pagination.page, fallbackPage),
      pageSize: toNumber(pagination.pageSize, PAGE_SIZE),
      total: toNumber(pagination.total, rows.length),
      totalPages: toNumber(pagination.totalPages),
      hasNext: Boolean(pagination.hasNext),
      hasPrevious: Boolean(pagination.hasPrevious),
    },
  };
};

const applyLocalFilters = (transactions: TransactionItem[], filters: TransactionFilters): TransactionListState => {
  const filtered = transactions
    .filter((transaction) => filters.type === 'all' || transaction.type === filters.type)
    .filter((transaction) => filters.category === 'all' || transaction.category === filters.category)
    .filter((transaction) => {
      const haystack = `${transaction.description} ${transaction.category}`.toLowerCase();
      return !filters.search || haystack.includes(filters.search.toLowerCase());
    })
    .filter((transaction) => !filters.startDate || normalizeDateInput(transaction.date) >= filters.startDate)
    .filter((transaction) => !filters.endDate || normalizeDateInput(transaction.date) <= filters.endDate)
    .sort((a, b) => normalizeDateInput(b.date).localeCompare(normalizeDateInput(a.date)) || String(b.id).localeCompare(String(a.id)));

  const totalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / PAGE_SIZE);
  const page = totalPages > 0 ? Math.min(filters.page, totalPages) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  return {
    rows,
    totals: computeTotals(filtered),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: filtered.length,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1 && totalPages > 0,
    },
  };
};

export const Transactions = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [offlineRows, setOfflineRows] = useState<TransactionItem[]>(SAMPLE_TRANSACTIONS);
  const [totals, setTotals] = useState<TotalsState>({ income: 0, expense: 0, net: 0, count: 0 });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<TransactionFormState>({
    type: 'expense',
    category: 'Food & Dining',
    amount: '',
    description: '',
    date: todayInput(),
  });
  const filters = useMemo<TransactionFilters>(
    () => ({ type: typeFilter, category: categoryFilter, search, startDate, endDate, page }),
    [categoryFilter, endDate, page, search, startDate, typeFilter],
  );
  const applyListState = useCallback((state: TransactionListState) => {
    setTransactions(state.rows);
    setTotals(state.totals);
    setPagination(state.pagination);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 260);

    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get('/transactions', { params: transactionParams(filters) });
        if (!alive) return;
        applyListState(normalizeTransactionResponse(response.data, filters.page));
        setOfflineMode(false);
      } catch {
        if (!alive) return;
        applyListState(applyLocalFilters(offlineRows, filters));
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
  }, [applyListState, filters, offlineRows]);

  const categoryOptions = useMemo(() => {
    const values = new Set([...DEFAULT_CATEGORIES, ...offlineRows.map((transaction) => transaction.category), ...transactions.map((transaction) => transaction.category)]);
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [offlineRows, transactions]);

  const dateLabel = useMemo(() => {
    if (startDate && endDate) return `${readableInputDate(startDate)} - ${readableInputDate(endDate)}`;
    if (startDate) return `From ${readableInputDate(startDate)}`;
    if (endDate) return `Until ${readableInputDate(endDate)}`;
    return 'All Dates';
  }, [endDate, startDate]);

  const openCreateDrawer = () => {
    setEditing(null);
    setForm({
      type: 'expense',
      category: 'Food & Dining',
      amount: '',
      description: '',
      date: todayInput(),
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (transaction: TransactionItem) => {
    setEditing(transaction);
    setForm({
      type: transaction.type,
      category: transaction.category,
      amount: String(transaction.amount),
      description: transaction.description,
      date: normalizeDateInput(transaction.date),
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const refreshLocalRows = useCallback(
    (nextRows: TransactionItem[]) => applyListState(applyLocalFilters(nextRows, filters)),
    [applyListState, filters],
  );

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!form.description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!form.category.trim()) {
      setFormError('Category is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      type: form.type,
      category: form.category.trim(),
      amount,
      description: form.description.trim(),
      date: form.date,
    };

    try {
      if (offlineMode) {
        const nextRows = editing
          ? offlineRows.map((transaction) => (transaction.id === editing.id ? { ...transaction, ...payload } : transaction))
          : [{ ...payload, id: `local-${Date.now()}` }, ...offlineRows];
        setOfflineRows(nextRows);
        refreshLocalRows(nextRows);
      } else if (editing) {
        await api.patch(`/transactions/${editing.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }

      setDrawerOpen(false);
      setEditing(null);
      if (!offlineMode) {
        setPage(1);
        const response = await api.get('/transactions', {
          params: transactionParams(filters, 1),
        });
        applyListState(normalizeTransactionResponse(response.data, 1));
      }
    } catch {
      setFormError('Could not save this transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction: TransactionItem) => {
    const confirmed = window.confirm(`Delete "${transaction.description}"?`);
    if (!confirmed) return;

    if (offlineMode) {
      const nextRows = offlineRows.filter((row) => row.id !== transaction.id);
      setOfflineRows(nextRows);
      refreshLocalRows(nextRows);
      return;
    }

    try {
      await api.delete(`/transactions/${transaction.id}`);
      setTransactions((current) => current.filter((row) => row.id !== transaction.id));
      setTotals((current) => ({
        ...current,
        income: transaction.type === 'income' ? current.income - transaction.amount : current.income,
        expense: transaction.type === 'expense' ? current.expense - transaction.amount : current.expense,
        net: transaction.type === 'income' ? current.net - transaction.amount : current.net + transaction.amount,
        count: Math.max(current.count - 1, 0),
      }));
      setPagination((current) => ({
        ...current,
        total: Math.max(current.total - 1, 0),
      }));
    } catch {
      setError('Could not delete this transaction.');
    }
  };

  return (
    <div className="transactions-page flex h-full min-h-0 flex-col gap-4 text-[#4E3629]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-[#FF7F96]">Pro</span>
            {offlineMode && (
              <span className="rounded-full bg-[#FFF2E7] px-2.5 py-0.5 text-[11px] font-black text-[#9D4E2B]">
                Local Preview
              </span>
            )}
          </div>
          <h2 className="text-[32px] font-black leading-tight tracking-tight text-[#2F2925]">Transactions</h2>
          <p className="mt-1 text-[15px] font-bold text-[#6F7785]">View and manage all your transactions.</p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white shadow-[0_8px_18px_rgba(92,65,45,0.08)] transition-colors hover:bg-[#FFF8F2]"
            aria-label="Search transactions"
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
          name="transactions-cat"
          className="pointer-events-none absolute right-[18%] top-[-92px] z-10 hidden h-[104px] w-[104px] select-none drop-shadow-[0_10px_12px_rgba(92,65,45,0.12)] xl:block"
          title="Transactions helper cat"
        />

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[192px_220px_186px_186px]">
            <label className="group relative block">
              <span className="sr-only">Transaction type</span>
              <Filter className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
              <select
                value={typeFilter}
                onChange={(event) => {
                  setPage(1);
                  setTypeFilter(event.target.value as 'all' | TransactionType);
                }}
                className="h-12 w-full appearance-none rounded-[16px] border border-[#EFE2D8] bg-[#FFFDFB] px-11 pr-9 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
              >
                <option value="all">All Accounts</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8B929C]">⌄</span>
            </label>

            <label className="group relative block">
              <span className="sr-only">Category</span>
              <ReceiptText className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setPage(1);
                  setCategoryFilter(event.target.value);
                }}
                className="h-12 w-full appearance-none rounded-[16px] border border-[#EFE2D8] bg-[#FFFDFB] px-11 pr-9 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
              >
                <option value="all">All Categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#8B929C]">⌄</span>
            </label>

            <label className="relative block">
              <span className="sr-only">Start date</span>
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setPage(1);
                  setStartDate(event.target.value);
                }}
                className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-[#FFFDFB] pl-11 pr-4 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">End date</span>
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setPage(1);
                  setEndDate(event.target.value);
                }}
                className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-[#FFFDFB] pl-11 pr-4 text-[14px] font-black text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.05)] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
              />
            </label>
          </div>

          <button
            onClick={openCreateDrawer}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] px-6 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(255,111,143,0.28)] transition-all hover:translate-y-[-1px] active:translate-y-0 xl:w-auto"
          >
            <Plus size={19} strokeWidth={3} />
            New Entry
          </button>
        </div>
      </div>

      <Card noPadding className="grid grid-cols-1 overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)] md:grid-cols-3">
        <div className="relative min-h-[112px] border-b border-[#EFE2D8] p-6 md:border-b-0 md:border-r">
          <p className="text-[14px] font-black text-[#536073]">Income</p>
          <p className="mt-4 text-[28px] font-black leading-tight text-[#2F2925]">{money.format(totals.income)}</p>
          <CuteSticker name="money-bag" className="absolute bottom-3 right-6 h-12 w-12 opacity-90" title="Income" />
        </div>
        <div className="relative min-h-[112px] border-b border-[#EFE2D8] p-6 md:border-b-0 md:border-r">
          <p className="text-[14px] font-black text-[#FF4F67]">Expenses</p>
          <p className="mt-4 text-[28px] font-black leading-tight text-[#2F2925]">{money.format(totals.expense)}</p>
          <CuteSticker name="shopping-bag" className="absolute bottom-3 right-6 h-12 w-12 opacity-90" title="Expenses" />
        </div>
        <div className="relative min-h-[112px] p-6">
          <p className="text-[14px] font-black text-[#FF4F67]">Net</p>
          <p className={`mt-4 text-[28px] font-black leading-tight ${totals.net >= 0 ? 'text-[#169B61]' : 'text-[#F27C8B]'}`}>
            {totals.net >= 0 ? '+' : ''}
            {money.format(totals.net)}
          </p>
          <CuteSticker name="piggy-bank" className="absolute bottom-3 right-6 h-12 w-12 opacity-90" title="Net savings" />
        </div>
      </Card>

      <Card noPadding className="flex min-h-[0] flex-1 flex-col overflow-hidden rounded-[22px] border border-[#EFE2D8] bg-[#FFFDFB] shadow-[0_12px_28px_rgba(92,65,45,0.08)]">
        <div className="flex flex-col gap-3 border-b border-[#EFE2D8] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#FFF2E7] text-[#FF7F96] shadow-[inset_0_0_0_1px_rgba(92,65,45,0.05)]">
              <Wallet size={19} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[17px] font-black text-[#2F2925]">Ledger</h3>
              <p className="text-[11px] font-bold text-[#8B929C]">{dateLabel}</p>
            </div>
          </div>

          <label className="relative block w-full xl:w-[360px]">
            <span className="sr-only">Search transactions</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[#8B929C]" size={17} strokeWidth={2.5} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search coffee, salary, category..."
              className="h-11 w-full rounded-full border border-[#EFE2D8] bg-[#FFF8F3] pl-11 pr-4 text-[14px] font-bold text-[#4E3629] shadow-inner outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
            />
          </label>
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-[16px] border border-[#F8C7CE] bg-[#FFF0F2] px-4 py-3 text-sm font-black text-[#C44B61]">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-5">
          <table className="w-full min-w-[920px] table-fixed border-collapse">
            <thead className="sticky top-0 z-[1] bg-[#FFFDFB]">
              <tr className="border-b border-[#EFE2D8] text-left text-[13px] font-black text-[#536073]">
                <th className="w-[52px] py-4">
                  <span className="block h-5 w-5 rounded-[6px] border-2 border-[#C8D0D8] bg-white" />
                </th>
                <th className="w-[150px] py-4">Date</th>
                <th className="py-4">Description</th>
                <th className="w-[230px] py-4">Category</th>
                <th className="w-[170px] py-4">Account</th>
                <th className="w-[150px] py-4 text-right">Amount</th>
                <th className="w-[116px] py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2E7] px-4 py-2 text-sm font-black text-[#9D4E2B]">
                      <LoaderCircle className="animate-spin" size={16} />
                      Loading ledger
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <CuteSticker name="waving-cat" className="mx-auto h-[86px] w-[94px]" title="Empty ledger cat" />
                    <p className="mt-2 text-lg font-black text-[#2F2925]">No transactions found</p>
                    <p className="mt-1 text-sm font-bold text-[#8B929C]">Try a softer filter or add a new entry.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const visual = categoryVisual(transaction);
                  return (
                    <tr key={transaction.id} className="border-b border-[#F0E4DA] text-[14px] font-bold text-[#2F2925] last:border-b-0">
                      <td className="py-4">
                        <span className="block h-5 w-5 rounded-[6px] border-2 border-[#C8D0D8] bg-white" />
                      </td>
                      <td className="py-4 text-[#536073]">{readableInputDate(transaction.date)}</td>
                      <td className="py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]"
                            style={{ backgroundColor: visual.bg }}
                          >
                            {visual.icon}
                          </span>
                          <span className="truncate font-black">{transaction.description}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span
                          className="inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[13px] font-black"
                          style={{ backgroundColor: visual.bg, color: visual.text }}
                        >
                          <span className="shrink-0 text-sm">{visual.icon}</span>
                          <span className="truncate">{transaction.category}</span>
                        </span>
                      </td>
                      <td className="py-4 text-[#536073]">{accountLabel(transaction)}</td>
                      <td className={`py-4 text-right font-black ${transaction.type === 'income' ? 'text-[#169B61]' : 'text-[#7B1F1F]'}`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {money.format(transaction.amount)}
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditDrawer(transaction)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] transition hover:bg-[#FFF8F2] hover:text-[#2F2925]"
                            aria-label={`Edit ${transaction.description}`}
                            title="Edit"
                          >
                            <Pencil size={14} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[#F4D5DA] bg-white text-[#F27C8B] transition hover:bg-[#FFF0F2]"
                            aria-label={`Delete ${transaction.description}`}
                            title="Delete"
                          >
                            <Trash2 size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#EFE2D8] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] font-black text-[#8B929C]">
            {pagination.total} entries
            {totals.count !== pagination.total ? ` in this view` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={!pagination.hasPrevious || loading}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <span className="min-w-[92px] text-center text-[12px] font-black text-[#536073]">
              Page {pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination.hasNext || loading}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </Card>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#4E3629]/20 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit transaction' : 'New transaction'}
            className="w-full max-w-[720px] rounded-t-[30px] border-x border-t border-[#EFE2D8] bg-[#FAF8F5] p-6 shadow-2xl animate-slide-up"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E8DCD0] pb-4">
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 rounded-[22px] bg-[#FFF2E7] p-1.5 shadow-[inset_0_0_0_1px_rgba(92,65,45,0.08)]">
                  <CuteSticker name="transactions-cat" className="h-full w-full" title="Entry helper cat" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[#FF7F96]">
                    <Sparkles size={13} strokeWidth={3} />
                    {editing ? 'Update Entry' : 'New Entry'}
                  </div>
                  <h3 className="mt-0.5 text-xl font-black text-[#2F2925]">
                    {editing ? 'Tidy this transaction' : 'Add a transaction'}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#EFE2D8] bg-white text-[#536073] hover:bg-[#FFF8F2]"
                aria-label="Close transaction form"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>

            <div className="grid gap-4 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Type</span>
                <div className="grid grid-cols-2 gap-2 rounded-full border border-[#EFE2D8] bg-[#FFFDFB] p-1 shadow-inner">
                  {(['expense', 'income'] as TransactionType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm((current) => ({ ...current, type }))}
                      className={`h-10 rounded-full text-sm font-black transition ${
                        form.type === type
                          ? type === 'income'
                            ? 'bg-[#EAFBF1] text-[#169B61] shadow-[0_6px_14px_rgba(22,155,97,0.12)]'
                            : 'bg-[#FFF0F2] text-[#F27C8B] shadow-[0_6px_14px_rgba(242,124,139,0.12)]'
                          : 'text-[#8B929C] hover:bg-[#FFF8F2]'
                      }`}
                      type="button"
                    >
                      {type === 'income' ? 'Income' : 'Expense'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Description</span>
                <input
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Coffee shop, bus fare, salary..."
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition placeholder:text-[#A7A0A0] focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Category</span>
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  list="transaction-categories"
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
                <datalist id="transaction-categories">
                  {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="h-12 w-full rounded-[16px] border border-[#EFE2D8] bg-white px-4 text-sm font-bold text-[#4E3629] outline-none transition focus:ring-4 focus:ring-[#FFD1DC]/40"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase text-[#8B929C]">Amount</span>
                <div className="flex h-12 items-center rounded-[16px] border border-[#EFE2D8] bg-white px-4 focus-within:ring-4 focus-within:ring-[#FFD1DC]/40">
                  <span className="mr-2 text-sm font-black text-[#8B929C]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    className="h-full w-full bg-transparent text-sm font-bold text-[#4E3629] outline-none"
                  />
                </div>
              </label>
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
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
