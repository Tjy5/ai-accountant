'use strict';

const express = require('express');

module.exports = function preferencesRouter(db) {
  const router = express.Router();

  // GET /api/preferences - 获取用户偏好列表
  router.get('/preferences', async (req, res, next) => {
    try {
      const userId = req.user.id;

      const preferences = await db.all(
        `SELECT id, keyword, category, created_at, updated_at
         FROM user_preferences
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ preferences });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/preferences - 创建用户偏好
  router.post('/preferences', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { keyword, category } = req.body || {};

      const k = typeof keyword === 'string' ? keyword.trim() : '';
      const c = typeof category === 'string' ? category.trim() : '';

      if (!k || !c) {
        return res.status(400).json({ error: '请提供关键词和分类' });
      }

      // Upsert: if keyword exists, update category; otherwise insert new row
      const existing = await db.get(
        'SELECT id FROM user_preferences WHERE user_id = ? AND keyword = ?',
        [userId, k]
      );

      if (existing && existing.id) {
        await db.run(
          `UPDATE user_preferences
           SET category = ?, deleted_at = NULL, updated_at = datetime('now')
           WHERE id = ?`,
          [c, existing.id]
        );

        const preference = await db.get(
          'SELECT id, keyword, category, created_at, updated_at FROM user_preferences WHERE id = ?',
          [existing.id]
        );

        return res.status(200).json({ preference });
      }

      const result = await db.run(
        `INSERT INTO user_preferences (user_id, keyword, category, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'), NULL)`,
        [userId, k, c]
      );

      const preference = await db.get(
        'SELECT id, keyword, category, created_at, updated_at FROM user_preferences WHERE id = ?',
        [result.lastID]
      );

      return res.status(201).json({ preference });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
