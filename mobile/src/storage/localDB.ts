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
            ON CONFLICT(id) DO UPDATE SET budget_type = excluded.budget_type, monthly_limit = excluded.monthly_limit, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
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
