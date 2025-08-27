'use strict'

const express = require('express');

module.exports = function transactionsRouter(db) {
  const router = express.Router();

  router.get('/transactions', async (req, res, next) => {
    try {
      const { keyword, type, startDate, endDate, minAmount, maxAmount, description } = req.query;
      const categories = (() => { const c = req.query.category; if (!c) return []; if (Array.isArray(c)) return c.filter(Boolean); return [c].filter(Boolean); })();
      const tags = (() => { const t = req.query.tag; if (!t) return []; if (Array.isArray(t)) return t.filter(Boolean); return [t].filter(Boolean); })();
      let baseQuery = 'SELECT * FROM transactions';
      const whereClauses = [];
      const params = [];
      if (type && type !== 'all') { whereClauses.push('type = ?'); params.push(type); }
      if (keyword) { whereClauses.push('(description LIKE ? OR category LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
      if (description) { whereClauses.push('description LIKE ?'); params.push(`%${description}%`); }
      if (categories.length > 0) { const ph = categories.map(() => '?').join(','); whereClauses.push(`category IN (${ph})`); params.push(...categories); }
      if (minAmount !== undefined) { whereClauses.push('amount >= ?'); params.push(Number(minAmount)); }
      if (maxAmount !== undefined) { whereClauses.push('amount <= ?'); params.push(Number(maxAmount)); }
      if (startDate) { whereClauses.push('date >= ?'); params.push(startDate); }
      if (endDate) { whereClauses.push('date <= ?'); params.push(endDate); }
      if (tags.length > 0) { const tagClauses = tags.map(() => `tags LIKE ?`).join(' OR '); whereClauses.push(`(${tagClauses})`); params.push(...tags.map(t => `%${t}%`)); }
      let finalQuery = baseQuery;
      if (whereClauses.length > 0) { finalQuery += ' WHERE ' + whereClauses.join(' AND '); }
      finalQuery += ' ORDER BY created_at DESC';
      const rows = await db.all(finalQuery, params);
      res.json(rows);
    } catch (err) { return next(err); }
  });

  router.post('/transactions', async (req, res, next) => {
    try {
      const { type, category, amount, description, date, is_voice_input, voice_input_text, tags } = req.body;
      if (!type || !['income', 'expense'].includes(type) || !category || typeof amount !== 'number') {
        return res.status(400).json({ error: '参数无效' });
      }
      let insertResult;
      if (date !== undefined && date !== null) {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          const iso = parsed.toISOString();
          insertResult = await db.run(
            `INSERT INTO transactions (type, category, amount, description, date, is_voice_input, voice_input_text, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [type, category, amount, description || null, iso, is_voice_input ? 1 : 0, voice_input_text || null, Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null)]
          );
        } else { return res.status(400).json({ error: '无效的日期格式' }); }
      } else {
        insertResult = await db.run(
          `INSERT INTO transactions (type, category, amount, description, is_voice_input, voice_input_text, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [type, category, amount, description || null, is_voice_input ? 1 : 0, voice_input_text || null, Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null)]
        );
      }
      const newRow = await db.get('SELECT * FROM transactions WHERE id = ?', [insertResult.lastID]);
      res.status(201).json(newRow);
    } catch (err) { return next(err); }
  });

  router.put('/transactions/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { type, category, amount, description, date, is_voice_input, voice_input_text, tags } = req.body;
      if (!type || !['income', 'expense'].includes(type) || !category || typeof amount !== 'number') {
        return res.status(400).json({ error: '参数无效' });
      }
      const existing = await db.get('SELECT * FROM transactions WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: '交易记录不存在' });
      let updateDate = existing.date;
      if (date !== undefined && date !== null) {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) updateDate = parsed.toISOString(); else return res.status(400).json({ error: '无效的日期格式' });
      }
      await db.run(
        `UPDATE transactions SET type = ?, category = ?, amount = ?, description = ?, date = ?, is_voice_input = ?, voice_input_text = ?, tags = COALESCE(?, tags) WHERE id = ?`,
        [type, category, amount, description || null, updateDate, is_voice_input ? 1 : 0, voice_input_text || null, Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null), id]
      );
      const updated = await db.get('SELECT * FROM transactions WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) { return next(err); }
  });

  router.delete('/transactions/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await db.run('DELETE FROM transactions WHERE id = ?', [id]);
      if (result.changes === 0) return res.status(404).json({ error: '交易记录不存在' });
      res.status(204).send();
    } catch (err) { return next(err); }
  });

  return router;
};


