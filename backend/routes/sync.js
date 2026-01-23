'use strict';

const express = require('express');

module.exports = function syncRouter(db) {
  const router = express.Router();

  // GET /api/sync?since=timestamp - 增量拉取
  router.get('/sync', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const since = req.query.since || '1970-01-01T00:00:00.000Z';

      // 查询所有表的变更（包括软删除的记录）
      const transactions = await db.all(
        `SELECT * FROM transactions
         WHERE user_id = ? AND updated_at > ?`,
        [userId, since]
      );

      const categories = await db.all(
        `SELECT * FROM categories
         WHERE user_id = ? AND updated_at > ?`,
        [userId, since]
      );

      const budgets = await db.all(
        `SELECT * FROM budgets
         WHERE user_id = ? AND updated_at > ?`,
        [userId, since]
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

  return router;
};
