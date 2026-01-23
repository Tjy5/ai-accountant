'use strict';

const express = require('express');

module.exports = function syncRouter(db) {
  const router = express.Router();

  // 辅助函数：将 ISO8601 或 SQLite datetime 转换为 Unix 秒
  const toUnixSeconds = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
  };

  const nowSeconds = () => Math.floor(Date.now() / 1000);

  // GET /api/sync?since=timestamp - 增量拉取
  router.get('/sync', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const since = req.query.since || '1970-01-01T00:00:00.000Z';

      // 将 since 转换为 Unix 秒进行比较
      const sinceSeconds = toUnixSeconds(since) || 0;

      // 使用 Unix 时间戳比较,避免字符串格式不一致问题
      const transactions = await db.all(
        `SELECT * FROM transactions
         WHERE user_id = ? AND strftime('%s', updated_at) > ?`,
        [userId, sinceSeconds]
      );

      const categories = await db.all(
        `SELECT * FROM categories
         WHERE user_id = ? AND strftime('%s', COALESCE(updated_at, created_at)) > ?`,
        [userId, sinceSeconds]
      );

      const budgets = await db.all(
        `SELECT * FROM budgets
         WHERE user_id = ? AND strftime('%s', COALESCE(updated_at, created_at)) > ?`,
        [userId, sinceSeconds]
      );

      res.json({
        transactions,
        categories,
        budgets,
        syncTimestamp: new Date().toISOString()
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/sync - 批量上行
  router.post('/sync', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const body = req.body || {};

      const report = {
        applied: { transactions: 0, categories: 0, budgets: 0, user_preferences: 0 },
        ignored: { transactions: 0, categories: 0, budgets: 0, user_preferences: 0 },
        errors: []
      };

      // 处理 transactions
      const applyTransactions = async (items) => {
        for (const item of items) {
          try {
            const id = Number(item?.id);
            if (!id || id <= 0) continue;

            const incomingUpdatedAt = item.updated_at || new Date().toISOString();

            const existing = await db.get(
              'SELECT updated_at FROM transactions WHERE id = ? AND user_id = ?',
              [id, userId]
            );

            // 如果本地版本更新,跳过
            if (existing && existing.updated_at >= incomingUpdatedAt) {
              report.ignored.transactions++;
              continue;
            }

            // 处理删除
            if (item.deleted_at) {
              if (existing) {
                await db.run(
                  'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                  [item.deleted_at, incomingUpdatedAt, id, userId]
                );
                report.applied.transactions++;
              }
              continue;
            }

            // 插入或更新
            if (existing) {
              await db.run(
                `UPDATE transactions SET
                  amount = ?, type = ?, category = ?, description = ?,
                  date = ?, updated_at = ?, deleted_at = NULL
                WHERE id = ? AND user_id = ?`,
                [item.amount, item.type, item.category, item.description,
                 item.date, incomingUpdatedAt, id, userId]
              );
            } else {
              await db.run(
                `INSERT INTO transactions
                  (id, user_id, amount, type, category, description, date, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, item.amount, item.type, item.category, item.description,
                 item.date, item.created_at || incomingUpdatedAt, incomingUpdatedAt]
              );
            }
            report.applied.transactions++;
          } catch (e) {
            report.errors.push({ table: 'transactions', id: item?.id, error: e.message });
          }
        }
      };

      // 处理 categories
      const applyCategories = async (items) => {
        for (const item of items) {
          try {
            const id = Number(item?.id);
            if (!id || id <= 0) continue;

            const incomingUpdatedAt = item.updated_at || new Date().toISOString();

            const existing = await db.get(
              'SELECT updated_at FROM categories WHERE id = ? AND user_id = ?',
              [id, userId]
            );

            if (existing && existing.updated_at >= incomingUpdatedAt) {
              report.ignored.categories++;
              continue;
            }

            if (item.deleted_at) {
              if (existing) {
                await db.run(
                  'UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                  [item.deleted_at, incomingUpdatedAt, id, userId]
                );
                report.applied.categories++;
              }
              continue;
            }

            if (existing) {
              await db.run(
                `UPDATE categories SET name = ?, type = ?, icon = ?, color = ?,
                  updated_at = ?, deleted_at = NULL WHERE id = ? AND user_id = ?`,
                [item.name, item.type, item.icon, item.color, incomingUpdatedAt, id, userId]
              );
            } else {
              await db.run(
                `INSERT INTO categories (id, user_id, name, type, icon, color, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, item.name, item.type, item.icon, item.color,
                 item.created_at || incomingUpdatedAt, incomingUpdatedAt]
              );
            }
            report.applied.categories++;
          } catch (e) {
            report.errors.push({ table: 'categories', id: item?.id, error: e.message });
          }
        }
      };

      // 处理 budgets
      const applyBudgets = async (items) => {
        for (const item of items) {
          try {
            const id = Number(item?.id);
            if (!id || id <= 0) continue;

            const incomingUpdatedAt = item.updated_at || new Date().toISOString();

            const existing = await db.get(
              'SELECT updated_at FROM budgets WHERE id = ? AND user_id = ?',
              [id, userId]
            );

            if (existing && existing.updated_at >= incomingUpdatedAt) {
              report.ignored.budgets++;
              continue;
            }

            if (item.deleted_at) {
              if (existing) {
                await db.run(
                  'UPDATE budgets SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
                  [item.deleted_at, incomingUpdatedAt, id, userId]
                );
                report.applied.budgets++;
              }
              continue;
            }

            if (existing) {
              await db.run(
                `UPDATE budgets SET category = ?, monthly_limit = ?,
                  updated_at = ?, deleted_at = NULL WHERE id = ? AND user_id = ?`,
                [item.category, item.monthly_limit, incomingUpdatedAt, id, userId]
              );
            } else {
              await db.run(
                `INSERT INTO budgets (id, user_id, category, monthly_limit, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [id, userId, item.category, item.monthly_limit,
                 item.created_at || incomingUpdatedAt, incomingUpdatedAt]
              );
            }
            report.applied.budgets++;
          } catch (e) {
            report.errors.push({ table: 'budgets', id: item?.id, error: e.message });
          }
        }
      };

      const txs = Array.isArray(body.transactions) ? body.transactions : [];
      const cats = Array.isArray(body.categories) ? body.categories : [];
      const buds = Array.isArray(body.budgets) ? body.budgets : [];

      await db.run('BEGIN');
      try {
        await applyTransactions(txs);
        await applyCategories(cats);
        await applyBudgets(buds);
        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
        throw e;
      }

      res.json({ ...report, syncTimestamp: new Date().toISOString() });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
