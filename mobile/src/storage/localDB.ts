import { openDatabaseAsync } from 'expo-sqlite/next';
import { generateLocalId } from '../utils/uuid';

const DB_NAME = 'ai_accountant.db';
let db: any = null;

// ============================================
// Event Emitter System
// ============================================
type DBEvent = 'transactionsChanged' | 'budgetsChanged' | 'syncApplied';
const listeners = new Map<DBEvent, Set<(payload: any) => void>>();

export function onDBEvent(event: DBEvent, handler: (payload: any) => void): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
  return () => listeners.get(event)?.delete(handler);
}

function emitDBEvent(event: DBEvent, payload: any): void {
  listeners.get(event)?.forEach(h => h(payload));
}

export type SqlParams = Array<string | number | null | boolean>;

export interface TransactionRecord {
  id: number;
  user_id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_voice_input: number;
  voice_input_text: string | null;
  tags: string | null;
}

export interface CategoryRecord {
  id: number;
  user_id: number;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string | null;
  color: string | null;
  description: string | null;
  is_default: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BudgetRecord {
  id: number;
  user_id: number;
  budget_type: 'category' | 'total';
  category: string | null;
  category_id: string | null;
  monthly_limit: number;
  quarterly_limit: number | null;
  yearly_limit: number | null;
  period: string | null;
  start_date: string | null;
  end_date: string | null;
  alert_threshold: number | null;
  is_active: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  parent_id: number | null;
}

export const openDatabase = async (): Promise<any> => {
  if (db) return db;
  db = await openDatabaseAsync(DB_NAME);
  return db;
};

export const executeSql = async (sql: string, params?: SqlParams): Promise<any> => {
  const database = await openDatabase();
  return await database.runAsync(sql, params || []);
};

export const queryAll = async <T = any>(sql: string, params?: SqlParams): Promise<T[]> => {
  const database = await openDatabase();
  return await database.getAllAsync(sql, params || []);
};

export const queryFirst = async <T = any>(sql: string, params?: SqlParams): Promise<T | null> => {
  const database = await openDatabase();
  return await database.getFirstAsync(sql, params || []);
};

export const initDatabase = async (): Promise<void> => {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      is_voice_input INTEGER DEFAULT 0,
      voice_input_text TEXT,
      tags TEXT
    )
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'both')),
      icon TEXT,
      color TEXT,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      UNIQUE(user_id, name)
    )
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      budget_type TEXT NOT NULL CHECK(budget_type IN ('category', 'total')),
      category TEXT,
      category_id TEXT,
      monthly_limit REAL NOT NULL,
      quarterly_limit REAL,
      yearly_limit REAL,
      period TEXT,
      start_date TEXT,
      end_date TEXT,
      alert_threshold REAL,
      is_active INTEGER,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      parent_id INTEGER
    )
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT
    )
  `);

  await executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)');
  await executeSql('CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)');
  await executeSql('CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)');
};

export const listTransactions = async (userId: number): Promise<TransactionRecord[]> => {
  return await queryAll<TransactionRecord>(
    'SELECT * FROM transactions WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC',
    [userId]
  );
};

export const getTransaction = async (userId: number, id: number): Promise<TransactionRecord | null> => {
  return await queryFirst<TransactionRecord>(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [id, userId]
  );
};

export const updateLocalTransaction = async (
  userId: number,
  id: number,
  data: { type: 'income' | 'expense'; category: string; amount: number; description?: string; date?: string }
): Promise<TransactionRecord> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    `UPDATE transactions SET type = ?, category = ?, amount = ?, description = ?, date = COALESCE(?, date), updated_at = ?
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [data.type, data.category, data.amount, data.description ?? null, data.date ?? null, now, id, userId]
  );
  if (!result.changes) {
    throw new Error('Transaction not found');
  }
  const row = await queryFirst<TransactionRecord>(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  if (!row) throw new Error('Failed to load updated transaction');
  emitDBEvent('transactionsChanged', { type: 'update', tx: row });
  return row;
};

export const softDeleteLocalTransaction = async (userId: number, id: number): Promise<string> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [now, now, id, userId]
  );
  if (!result.changes) throw new Error('Transaction not found');
  emitDBEvent('transactionsChanged', { type: 'delete', id });
  return now;
};

export const createLocalTransaction = async (
  userId: number,
  data: { type: 'income' | 'expense'; category: string; amount: number; description?: string; date?: string }
): Promise<TransactionRecord> => {
  const now = new Date().toISOString();
  const transactionDate = data.date || now;
  const localId = generateLocalId();
  await executeSql(
    `INSERT INTO transactions (id, user_id, type, category, amount, description, date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [localId, userId, data.type, data.category, data.amount, data.description ?? null, transactionDate, now, now]
  );
  const row = await queryFirst<TransactionRecord>(
    'SELECT * FROM transactions WHERE id = ?',
    [localId]
  );
  if (!row) throw new Error('Failed to create transaction');
  emitDBEvent('transactionsChanged', { type: 'create', tx: row });
  return row;
};

export const createLocalTransactions = async (
  userId: number,
  items: Array<{ type: 'income' | 'expense'; category: string; amount: number; description?: string; date?: string }>
): Promise<TransactionRecord[]> => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const now = new Date().toISOString();
  const created: TransactionRecord[] = [];

  await executeSql('BEGIN');
  try {
    for (const item of items) {
      const localId = generateLocalId();
      const transactionDate = item.date || now;
      await executeSql(
        `INSERT INTO transactions (id, user_id, type, category, amount, description, date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [localId, userId, item.type, item.category, item.amount, item.description ?? null, transactionDate, now, now]
      );
      const row = await queryFirst<TransactionRecord>(
        'SELECT * FROM transactions WHERE id = ?',
        [localId]
      );
      if (row) created.push(row);
    }
    await executeSql('COMMIT');
  } catch (e) {
    await executeSql('ROLLBACK');
    throw e;
  }

  if (created.length > 0) {
    emitDBEvent('transactionsChanged', { type: 'batchCreate', txs: created });
  }
  return created;
};

export const listCategories = async (userId: number): Promise<CategoryRecord[]> => {
  return await queryAll<CategoryRecord>(
    'SELECT * FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY usage_count DESC, name ASC',
    [userId]
  );
};

export const getCategory = async (userId: number, id: number): Promise<CategoryRecord | null> => {
  return await queryFirst<CategoryRecord>(
    'SELECT * FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [id, userId]
  );
};

export const createLocalCategory = async (
  userId: number,
  data: { name: string; type: 'income' | 'expense' | 'both'; icon: string; color: string; description?: string }
): Promise<CategoryRecord> => {
  const now = new Date().toISOString();
  const localId = generateLocalId();
  await executeSql(
    `INSERT INTO categories (id, user_id, name, type, icon, color, description, is_default, usage_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [localId, userId, data.name, data.type, data.icon, data.color, data.description ?? null, now, now]
  );
  const row = await queryFirst<CategoryRecord>(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?',
    [localId, userId]
  );
  if (!row) throw new Error('Failed to create category');
  return row;
};

export const updateLocalCategory = async (
  userId: number,
  id: number,
  data: { name: string; type: 'income' | 'expense' | 'both'; icon: string; color: string; description?: string }
): Promise<CategoryRecord> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    `UPDATE categories SET name = ?, type = ?, icon = ?, color = ?, description = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [data.name, data.type, data.icon, data.color, data.description ?? null, now, id, userId]
  );
  if (!result.changes) throw new Error('Category not found');
  const row = await queryFirst<CategoryRecord>('SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) throw new Error('Failed to load updated category');
  return row;
};

export const softDeleteLocalCategory = async (userId: number, id: number): Promise<string> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    'UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [now, now, id, userId]
  );
  if (!result.changes) throw new Error('Category not found');
  return now;
};

export const listBudgets = async (userId: number): Promise<BudgetRecord[]> => {
  return await queryAll<BudgetRecord>(
    'SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL ORDER BY budget_type DESC, created_at DESC',
    [userId]
  );
};

export const getBudget = async (userId: number, id: number): Promise<BudgetRecord | null> => {
  return await queryFirst<BudgetRecord>(
    'SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [id, userId]
  );
};

export const createLocalBudget = async (
  userId: number,
  data: {
    budget_type: 'category' | 'total';
    category?: string | null;
    category_id?: string | null;
    parent_id?: number | null;
    monthly_limit: number;
    quarterly_limit?: number | null;
    yearly_limit?: number | null;
    period?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    alert_threshold?: number | null;
    is_active?: number | null;
    description?: string | null;
  }
): Promise<BudgetRecord> => {
  const now = new Date().toISOString();
  const monthlyLimit = Number(data.monthly_limit);
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
    throw new Error('Budget amount must be greater than 0');
  }

  if (data.budget_type === 'total') {
    const existing = await queryFirst<{ id: number }>(
      "SELECT id FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = 'total' LIMIT 1",
      [userId]
    );
    if (existing) throw new Error('Total budget already exists');
  }

  const localId = generateLocalId();
  await executeSql(
    `INSERT INTO budgets (id, user_id, budget_type, category, category_id, parent_id, monthly_limit, quarterly_limit, yearly_limit, period, start_date, end_date, alert_threshold, is_active, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      localId, userId, data.budget_type, data.category ?? null, data.category_id ?? null, data.parent_id ?? null,
      monthlyLimit, data.quarterly_limit != null ? Number(data.quarterly_limit) : null,
      data.yearly_limit != null ? Number(data.yearly_limit) : null, data.period ?? null,
      data.start_date ?? null, data.end_date ?? null,
      data.alert_threshold != null ? Number(data.alert_threshold) : null,
      data.is_active != null ? Number(data.is_active) : null,
      data.description ?? null, now, now
    ]
  );
  const row = await queryFirst<BudgetRecord>('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [localId, userId]);
  if (!row) throw new Error('Failed to create budget');
  emitDBEvent('budgetsChanged', { type: 'create', budget: row });
  return row;
};

export const updateLocalBudget = async (
  userId: number,
  id: number,
  data: {
    budget_type: 'category' | 'total';
    category?: string | null;
    category_id?: string | null;
    parent_id?: number | null;
    monthly_limit: number;
    quarterly_limit?: number | null;
    yearly_limit?: number | null;
    period?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    alert_threshold?: number | null;
    is_active?: number | null;
    description?: string | null;
  }
): Promise<BudgetRecord> => {
  const now = new Date().toISOString();
  const monthlyLimit = Number(data.monthly_limit);
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
    throw new Error('Budget amount must be greater than 0');
  }

  if (data.budget_type === 'total') {
    const existing = await queryFirst<{ id: number }>(
      "SELECT id FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = 'total' AND id != ? LIMIT 1",
      [userId, id]
    );
    if (existing) throw new Error('Total budget already exists');
  }

  const result = await executeSql(
    `UPDATE budgets SET budget_type = ?, category = ?, category_id = ?, parent_id = ?, monthly_limit = ?, quarterly_limit = ?, yearly_limit = ?, period = ?, start_date = ?, end_date = ?, alert_threshold = ?, is_active = ?, description = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [
      data.budget_type, data.category ?? null, data.category_id ?? null, data.parent_id ?? null,
      monthlyLimit, data.quarterly_limit != null ? Number(data.quarterly_limit) : null,
      data.yearly_limit != null ? Number(data.yearly_limit) : null, data.period ?? null,
      data.start_date ?? null, data.end_date ?? null,
      data.alert_threshold != null ? Number(data.alert_threshold) : null,
      data.is_active != null ? Number(data.is_active) : null,
      data.description ?? null, now, id, userId
    ]
  );
  if (!result.changes) throw new Error('Budget not found');
  const row = await queryFirst<BudgetRecord>('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) throw new Error('Failed to load updated budget');
  emitDBEvent('budgetsChanged', { type: 'update', budget: row });
  return row;
};

export const softDeleteLocalBudget = async (userId: number, id: number): Promise<string> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    'UPDATE budgets SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [now, now, id, userId]
  );
  if (!result.changes) throw new Error('Budget not found');
  emitDBEvent('budgetsChanged', { type: 'delete', id });
  return now;
};

const normalizeIso = (val: any): string => {
  if (!val) return new Date().toISOString();
  return String(val);
};

const encodeTags = (tags: any): string | null => {
  if (!tags) return null;
  if (typeof tags === 'string') return tags;
  if (Array.isArray(tags)) return JSON.stringify(tags);
  return null;
};

type BatchStatement = { sql: string; params?: SqlParams };

const execBatch = async (statements: BatchStatement[]): Promise<void> => {
  for (const stmt of statements) {
    await executeSql(stmt.sql, stmt.params);
  }
};

export const upsertTransactions = async (userId: number, items: any[]): Promise<void> => {
  const statements: BatchStatement[] = [];
  for (const item of items) {
    if (!item || item.id == null) continue;
    const id = Number(item.id);
    if (!Number.isFinite(id)) continue;

    const updatedAt = item.updated_at ? String(item.updated_at) : new Date().toISOString();
    const createdAt = item.created_at ? String(item.created_at) : updatedAt;

    statements.push({
      sql: `INSERT INTO transactions (user_id, id, type, category, amount, description, date, created_at, updated_at, deleted_at, is_voice_input, voice_input_text, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              type = excluded.type,
              category = excluded.category,
              amount = excluded.amount,
              description = excluded.description,
              date = excluded.date,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at`,
      params: [
        userId,
        id,
        item.type,
        item.category,
        Number(item.amount) || 0,
        item.description ?? null,
        normalizeIso(item.date),
        createdAt,
        updatedAt,
        item.deleted_at ?? null,
        item.is_voice_input ? 1 : 0,
        item.voice_input_text ?? null,
        encodeTags(item.tags),
      ],
    });
  }
  if (statements.length === 0) return;
  await execBatch(statements);
};

export const upsertCategories = async (userId: number, items: any[]): Promise<void> => {
  const statements: BatchStatement[] = [];
  for (const item of items) {
    if (!item || item.id == null) continue;
    const id = Number(item.id);
    if (!Number.isFinite(id)) continue;

    const updatedAt = item.updated_at ? String(item.updated_at) : new Date().toISOString();
    const createdAt = item.created_at ? String(item.created_at) : updatedAt;

    statements.push({
      sql: `INSERT INTO categories (user_id, id, name, type, icon, color, description, is_default, usage_count, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              icon = excluded.icon,
              color = excluded.color,
              description = excluded.description,
              is_default = excluded.is_default,
              usage_count = excluded.usage_count,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at`,
      params: [
        userId,
        id,
        item.name ?? '',
        item.type ?? 'both',
        item.icon ?? null,
        item.color ?? null,
        item.description ?? null,
        item.is_default ? 1 : 0,
        Number(item.usage_count) || 0,
        createdAt,
        updatedAt,
        item.deleted_at ?? null,
      ],
    });
  }
  if (statements.length === 0) return;
  await execBatch(statements);
};

export const upsertBudgets = async (userId: number, items: any[]): Promise<void> => {
  const statements: BatchStatement[] = [];
  for (const item of items) {
    if (!item || item.id == null) continue;
    const id = Number(item.id);
    if (!Number.isFinite(id)) continue;

    const updatedAt = item.updated_at ? String(item.updated_at) : new Date().toISOString();
    const createdAt = item.created_at ? String(item.created_at) : updatedAt;

    statements.push({
      sql: `INSERT INTO budgets (user_id, id, budget_type, category, category_id, monthly_limit, quarterly_limit, yearly_limit, period, start_date, end_date, alert_threshold, is_active, description, created_at, updated_at, deleted_at, parent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              budget_type = excluded.budget_type,
              category = excluded.category,
              category_id = excluded.category_id,
              monthly_limit = excluded.monthly_limit,
              quarterly_limit = excluded.quarterly_limit,
              yearly_limit = excluded.yearly_limit,
              period = excluded.period,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              alert_threshold = excluded.alert_threshold,
              is_active = excluded.is_active,
              description = excluded.description,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              parent_id = excluded.parent_id`,
      params: [
        userId, id, item.budget_type ?? 'category', item.category ?? null, item.category_id ?? null,
        Number(item.monthly_limit) || 0, item.quarterly_limit != null ? Number(item.quarterly_limit) : null,
        item.yearly_limit != null ? Number(item.yearly_limit) : null, item.period ?? null,
        item.start_date ?? null, item.end_date ?? null, item.alert_threshold != null ? Number(item.alert_threshold) : null,
        item.is_active != null ? Number(item.is_active) : null, item.description ?? null,
        createdAt, updatedAt, item.deleted_at ?? null, item.parent_id != null ? Number(item.parent_id) : null,
      ],
    });
  }
  if (statements.length === 0) return;
  await execBatch(statements);
};

export const applyServerSync = async (
  userId: number,
  payload: { transactions?: any[]; categories?: any[]; budgets?: any[] }
): Promise<void> => {
  const txs = Array.isArray(payload.transactions) ? payload.transactions : [];
  const cats = Array.isArray(payload.categories) ? payload.categories : [];
  const buds = Array.isArray(payload.budgets) ? payload.budgets : [];
  await upsertTransactions(userId, txs);
  await upsertCategories(userId, cats);
  await upsertBudgets(userId, buds);
  emitDBEvent('syncApplied', { transactions: txs.length, categories: cats.length, budgets: buds.length });
};

export const getDashboardStats = async (userId: number, startDate: string, endDate: string) => {
  const row = await queryFirst<{ income: number | null; expense: number | null; count: number | null }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
       COUNT(*) as count
     FROM transactions
     WHERE user_id = ?
       AND deleted_at IS NULL
       AND DATE(date) >= DATE(?)
       AND DATE(date) <= DATE(?)`,
    [userId, startDate, endDate]
  );
  return {
    income: Number(row?.income) || 0,
    expense: Number(row?.expense) || 0,
    count: Number(row?.count) || 0
  };
};

export const getCategoryStats = async (userId: number, startDate: string, endDate: string) => {
  const rows = await queryAll<{ category: string; total: number | null }>(
    `SELECT category, COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ?
       AND type = 'expense'
       AND deleted_at IS NULL
       AND DATE(date) >= DATE(?)
       AND DATE(date) <= DATE(?)
     GROUP BY category
     ORDER BY total DESC
     LIMIT 10`,
    [userId, startDate, endDate]
  );
  return rows.map(r => ({ category: String(r.category || ''), total: Number(r.total) || 0 }));
};

export const getMonthlyTrend = async (userId: number, startDate: string) => {
  const rows = await queryAll<{ month: string | null; type: string | null; total: number | null }>(
    `SELECT strftime('%Y-%m', DATE(date)) as month, type, COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ?
       AND deleted_at IS NULL
       AND DATE(date) >= DATE(?)
     GROUP BY month, type
     ORDER BY month ASC`,
    [userId, startDate]
  );
  return rows
    .filter(r => r.month && (r.type === 'income' || r.type === 'expense'))
    .map(r => ({ month: String(r.month), type: r.type as 'income' | 'expense', total: Number(r.total) || 0 }));
};

// ============================================
// HUD Budget Status
// ============================================
export interface HudBudgetStatus {
  hasBudget: boolean;
  period: string;
  limit: number;
  spent: number;
  percentage: number;
  budgetId: number | null;
}

const toYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getPeriodRange = (period: string): { start: string; end: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'monthly') {
    const start = toYmd(new Date(year, month, 1));
    const end = toYmd(new Date(year, month + 1, 0));
    return { start, end };
  }
  if (period === 'quarterly') {
    const startMonth = Math.floor(month / 3) * 3;
    const start = toYmd(new Date(year, startMonth, 1));
    const end = toYmd(new Date(year, startMonth + 3, 0));
    return { start, end };
  }
  const start = toYmd(new Date(year, 0, 1));
  const end = toYmd(new Date(year, 12, 0));
  return { start, end };
};

const getBudgetLimit = (budget: BudgetRecord): number => {
  const monthly = Number(budget.monthly_limit) || 0;
  const period = budget.period || 'monthly';
  if (period === 'quarterly') {
    return budget.quarterly_limit != null ? Number(budget.quarterly_limit) : monthly * 3;
  }
  if (period === 'yearly') {
    return budget.yearly_limit != null ? Number(budget.yearly_limit) : monthly * 12;
  }
  return monthly;
};

export async function getHudBudgetStatus(userId: number): Promise<HudBudgetStatus> {
  const totalBudget = await queryFirst<BudgetRecord>(
    "SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = 'total' LIMIT 1",
    [userId]
  );

  if (!totalBudget) {
    return { hasBudget: false, period: 'monthly', limit: 0, spent: 0, percentage: 0, budgetId: null };
  }

  const period = totalBudget.period || 'monthly';
  const range = getPeriodRange(period);
  const limit = getBudgetLimit(totalBudget);

  const spentRow = await queryFirst<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense'
     AND DATE(date, 'localtime') >= ? AND DATE(date, 'localtime') <= ?`,
    [userId, range.start, range.end]
  );

  const spent = spentRow?.total || 0;
  return {
    hasBudget: true,
    period,
    limit,
    spent,
    percentage: limit > 0 ? (spent / limit) * 100 : 0,
    budgetId: totalBudget.id,
  };
}
