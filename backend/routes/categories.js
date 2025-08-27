'use strict'

const express = require('express');

module.exports = function categoriesRouter(db) {
  const router = express.Router();

  router.get('/categories', async (req, res, next) => {
    try {
      const rows = await db.all('SELECT * FROM categories ORDER BY name');
      res.json({ categories: rows });
    } catch (err) { return next(err); }
  });

  router.post('/categories', async (req, res, next) => {
    try {
      const { name, type, icon, color, description, isDefault } = req.body || {};
      if (!name || !type) {
        return res.status(400).json({ error: '缺少必需字段: name/type' });
      }
      if (!['income', 'expense', 'both'].includes(type)) {
        return res.status(400).json({ error: '无效的分类类型' });
      }
      await db.run(
        `INSERT INTO categories (name, type, icon, color, description, is_default, usage_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [name.trim(), type, icon || null, color || null, description || null, isDefault ? 1 : 0]
      );
      const row = await db.get('SELECT * FROM categories WHERE name = ?', [name.trim()]);
      res.status(201).json(row);
    } catch (err) { return next(err); }
  });

  router.put('/categories/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, type, icon, color, description } = req.body || {};
      const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
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
         WHERE id = ?`,
        [name ? name.trim() : null, type || null, icon || null, color || null, description || null, id]
      );
      const updated = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) { return next(err); }
  });

  router.delete('/categories/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: '分类不存在' });
      if (existing.is_default) return res.status(400).json({ error: '默认分类不能删除' });
      const result = await db.run('DELETE FROM categories WHERE id = ?', [id]);
      if (result.changes === 0) return res.status(404).json({ error: '分类不存在' });
      res.status(204).send();
    } catch (err) { return next(err); }
  });

  return router;
};


