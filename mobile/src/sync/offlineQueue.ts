import { api } from '../../../shared/utils/api';
import { secureStorage } from '../storage/secureStorage';
import { applyServerSync, executeSql, queryAll } from '../storage/localDB';

export type QueueTableName = 'transactions' | 'categories' | 'budgets';
export type QueueOperation = 'upsert' | 'delete';

type OfflineQueueRow = {
  id: number;
  user_id: number;
  table_name: QueueTableName;
  operation: QueueOperation;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

const safeJsonParse = (raw: string): any | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const enqueue = async (
  userId: number,
  tableName: QueueTableName,
  operation: QueueOperation,
  payload: any
): Promise<void> => {
  await executeSql(
    `INSERT INTO offline_queue (user_id, table_name, operation, payload, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    [userId, tableName, operation, JSON.stringify(payload), new Date().toISOString()]
  );
};

export const enqueueMany = async (
  userId: number,
  tableName: QueueTableName,
  operation: QueueOperation,
  payloads: any[]
): Promise<void> => {
  if (!Array.isArray(payloads) || payloads.length === 0) return;
  const now = new Date().toISOString();
  await executeSql('BEGIN');
  try {
    for (const payload of payloads) {
      await executeSql(
        `INSERT INTO offline_queue (user_id, table_name, operation, payload, created_at, attempts, last_error)
         VALUES (?, ?, ?, ?, ?, 0, NULL)`,
        [userId, tableName, operation, JSON.stringify(payload), now]
      );
    }
    await executeSql('COMMIT');
  } catch (e) {
    await executeSql('ROLLBACK');
    throw e;
  }
};

export const getPendingCount = async (userId: number): Promise<number> => {
  const rows = await queryAll<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_queue WHERE user_id = ?',
    [userId]
  );
  return rows[0]?.count ?? 0;
};

export const flushQueue = async (userId: number): Promise<void> => {
  const rows = await queryAll<OfflineQueueRow>(
    'SELECT * FROM offline_queue WHERE user_id = ? ORDER BY id ASC',
    [userId]
  );
  if (rows.length === 0) return;

  const lastByKey = new Map<string, OfflineQueueRow>();
  for (const row of rows) {
    const payload = safeJsonParse(row.payload);
    const key = `${row.table_name}:${payload?.id ?? row.id}`;
    lastByKey.set(key, row);
  }

  const batch = {
    transactions: [] as any[],
    categories: [] as any[],
    budgets: [] as any[],
  };

  for (const row of lastByKey.values()) {
    const payload = safeJsonParse(row.payload);
    if (!payload) continue;
    if (row.table_name === 'transactions') batch.transactions.push(payload);
    if (row.table_name === 'categories') batch.categories.push(payload);
    if (row.table_name === 'budgets') batch.budgets.push(payload);
  }

  try {
    await api.post('/api/sync', batch);
    await executeSql('DELETE FROM offline_queue WHERE user_id = ?', [userId]);
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'sync_failed';
    await executeSql(
      'UPDATE offline_queue SET attempts = attempts + 1, last_error = ? WHERE user_id = ?',
      [msg, userId]
    );
    throw err;
  }
};

export const syncNow = async (userId: number): Promise<void> => {
  await flushQueue(userId);

  const since = (await secureStorage.getLastSyncTimestamp()) ?? '1970-01-01T00:00:00.000Z';

  const payload = await api.get<{
    transactions: any[];
    categories: any[];
    budgets: any[];
    syncTimestamp: string;
  }>('/api/sync', { since });

  await applyServerSync(userId, payload);
  await secureStorage.setLastSyncTimestamp(payload.syncTimestamp);
};
