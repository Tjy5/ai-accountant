import { openDatabaseAsync, Database, RunResult } from 'expo-sqlite/next';
import { generateLocalId } from '../utils/uuid';

const DB_NAME = 'ai_accountant.db';
let db: Database | null = null;

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

export const openDatabase = async (): Promise<Database> => {
  if (db) return db;
  db = await openDatabaseAsync(DB_NAME);
  return db;
};

export const executeSql = async (sql: string, params?: SqlParams): Promise<RunResult> => {
  const database = await openDatabase();
  return await database.runAsync(sql, params || []);
};

export const queryAll = async <T = any>(sql: string, params?: SqlParams): Promise<T[]> => {
  const database = await openDatabase();
  return await database.allAsync<T>(sql, params || []);
};

export const queryFirst = async <T = any>(sql: string, params?: SqlParams): Promise<T | null> => {
  const rows = await queryAll<T>(sql, params);
  return rows[0] ?? null;
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
  return row;
};

export const softDeleteLocalTransaction = async (userId: number, id: number): Promise<string> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [now, now, id, userId]
  );
  if (!result.changes) throw new Error('Transaction not found');
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
  return row;
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
  return row;
};

export const softDeleteLocalBudget = async (userId: number, id: number): Promise<string> => {
  const now = new Date().toISOString();
  const result = await executeSql(
    'UPDATE budgets SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [now, now, id, userId]
  );
  if (!result.changes) throw new Error('Budget not found');
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
};
