'use strict'

const express = require('express');

module.exports = function categoriesRouter(db) {
  const router = express.Router();

  router.get('/categories', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const rows = await db.all(
        'SELECT * FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY name',
        [userId]
      );
      res.json({ categories: Array.isArray(rows) ? rows : [] });
    } catch (err) { return next(err); }
  });

  router.post('/categories', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { name, type, icon, color, description, isDefault } = req.body || {};
      if (!name || !type) {
        return res.status(400).json({ error: '缺少必需字段: name/type' });
      }
      if (!['income', 'expense', 'both'].includes(type)) {
        return res.status(400).json({ error: '无效的分类类型' });
      }
      const normalizedName = name.trim();
      const existing = await db.get(
        'SELECT id FROM categories WHERE user_id = ? AND name = ? AND deleted_at IS NULL',
        [userId, normalizedName]
      );
      if (existing) return res.status(409).json({ error: '分类名称已存在' });

      const result = await db.run(
        `INSERT INTO categories (user_id, name, type, icon, color, description, is_default, usage_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [userId, normalizedName, type, icon || null, color || null, description || null, isDefault ? 1 : 0]
      );
      const row = await db.get('SELECT * FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [result.lastID, userId]);
      res.status(201).json(row);
    } catch (err) { return next(err); }
  });

  router.put('/categories/:id', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, type, icon, color, description } = req.body || {};
      const existing = await db.get('SELECT * FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, userId]);
      if (!existing) return res.status(404).json({ error: '分类不存在' });
      if (type && !['income', 'expense', 'both'].includes(type)) {
        return res.status(400).json({ error: '无效的分类类型' });
      }
      await db.run(
        `UPDATE categories SET
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          icon = COALESCE(?, icon),
          color = COALESCE(?, color),
          description = COALESCE(?, description),
          updated_at = datetime('now')
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [name ? name.trim() : null, type || null, icon || null, color || null, description || null, id, userId]
      );
      const updated = await db.get('SELECT * FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, userId]);
      res.json(updated);
    } catch (err) { return next(err); }
  });

  router.delete('/categories/:id', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const existing = await db.get('SELECT * FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, userId]);
      if (!existing) return res.status(404).json({ error: '分类不存在' });
      if (existing.is_default) return res.status(400).json({ error: '默认分类不能删除' });
      const result = await db.run(
        'UPDATE categories SET deleted_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [id, userId]
      );
      if (result.changes === 0) return res.status(404).json({ error: '分类不存在' });
      res.status(204).send();
    } catch (err) { return next(err); }
  });

  return router;
};


