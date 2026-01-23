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
      const { keyword, category } = req.body;

      if (!keyword || !category) {
        return res.status(400).json({ error: '请提供关键词和分类' });
      }

      // 检查是否已存在相同的关键词
      const existing = await db.get(
        'SELECT id FROM user_preferences WHERE user_id = ? AND keyword = ? AND deleted_at IS NULL',
        [userId, keyword]
      );

      if (existing) {
        return res.status(409).json({ error: '该关键词已存在' });
      }

      const result = await db.run(
        `INSERT INTO user_preferences (user_id, keyword, category, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, keyword, category]
      );

      const preference = await db.get(
        'SELECT id, keyword, category, created_at, updated_at FROM user_preferences WHERE id = ?',
        [result.lastID]
      );

      res.status(201).json({ preference });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
