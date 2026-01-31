'use strict'

const express = require('express');

module.exports = function transactionsRouter(db) {
  const router = express.Router();

  function toPositiveIntOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  function toFiniteNumberOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function parseCursor(cursor) {
    const raw = typeof cursor === 'string' ? cursor.trim() : '';
    if (!raw) return null;

    // Format: base64url(JSON.stringify({ createdAt, id }))
    try {
      const json = Buffer.from(raw, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : '';
      const id = Number(parsed.id);
      if (createdAt && Number.isInteger(id) && id > 0) return { createdAt, id };
    } catch {}

    // Fallback format: `${createdAt}|${id}`
    const parts = raw.split('|');
    if (parts.length === 2) {
      const createdAt = parts[0];
      const id = Number(parts[1]);
      if (createdAt && Number.isInteger(id) && id > 0) return { createdAt, id };
    }

    return null;
  }

  function makeCursor(row) {
    if (!row || typeof row !== 'object') return null;
    const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
    const id = Number(row.id);
    if (!createdAt || !Number.isInteger(id) || id <= 0) return null;
    return Buffer.from(JSON.stringify({ createdAt, id }), 'utf8').toString('base64url');
  }

  router.get('/transactions', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { keyword, type, startDate, endDate, minAmount, maxAmount, description } = req.query;
      const categories = (() => { const c = req.query.category; if (!c) return []; if (Array.isArray(c)) return c.filter(Boolean); return [c].filter(Boolean); })();
      const tags = (() => { const t = req.query.tag; if (!t) return []; if (Array.isArray(t)) return t.filter(Boolean); return [t].filter(Boolean); })();

      const page = toPositiveIntOrNull(req.query.page);
      const pageSize = toPositiveIntOrNull(req.query.pageSize ?? req.query.limit) || null;
      const cursor = parseCursor(req.query.cursor);
      const wantsPaging = Boolean(page || pageSize || cursor);
      const limit = Math.min(pageSize || 50, 200);
      const offset = page ? (page - 1) * limit : 0;

      let baseQuery = 'SELECT * FROM transactions';
      const whereClauses = ['user_id = ?', 'deleted_at IS NULL'];
      const params = [userId];
      if (type && type !== 'all') { whereClauses.push('type = ?'); params.push(type); }
      if (keyword) {
        const k = String(keyword).trim().slice(0, 200);
        if (k) { whereClauses.push('(description LIKE ? OR category LIKE ?)'); params.push(`%${k}%`, `%${k}%`); }
      }
      if (description) {
        const d = String(description).trim().slice(0, 200);
        if (d) { whereClauses.push('description LIKE ?'); params.push(`%${d}%`); }
      }
      if (categories.length > 0) { const ph = categories.map(() => '?').join(','); whereClauses.push(`category IN (${ph})`); params.push(...categories); }
      const minA = toFiniteNumberOrNull(minAmount);
      if (minA !== null) { whereClauses.push('amount >= ?'); params.push(minA); }
      const maxA = toFiniteNumberOrNull(maxAmount);
      if (maxA !== null) { whereClauses.push('amount <= ?'); params.push(maxA); }
      if (startDate) { whereClauses.push('DATE(date) >= DATE(?)'); params.push(String(startDate).slice(0, 10)); }
      if (endDate) { whereClauses.push('DATE(date) <= DATE(?)'); params.push(String(endDate).slice(0, 10)); }
      if (tags.length > 0) { const tagClauses = tags.map(() => `tags LIKE ?`).join(' OR '); whereClauses.push(`(${tagClauses})`); params.push(...tags.map(t => `%${t}%`)); }

      if (cursor) {
        whereClauses.push('(created_at < ? OR (created_at = ? AND id < ?))');
        params.push(cursor.createdAt, cursor.createdAt, cursor.id);
      }
      let finalQuery = baseQuery;
      if (whereClauses.length > 0) { finalQuery += ' WHERE ' + whereClauses.join(' AND '); }
      finalQuery += ' ORDER BY created_at DESC, id DESC';
      if (wantsPaging) {
        finalQuery += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }

      const rows = await db.all(finalQuery, params);
      const list = Array.isArray(rows) ? rows : [];

      if (!wantsPaging) {
        return res.json(list);
      }

      const nextCursor = list.length === limit ? makeCursor(rows[rows.length - 1]) : null;
      return res.json({
        transactions: list,
        pageInfo: {
          limit,
          page: page || null,
          nextCursor,
          hasMore: Boolean(nextCursor),
        }
      });
    } catch (err) { return next(err); }
  });

  router.post('/transactions', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { type, category, amount, description, date, is_voice_input, voice_input_text, tags } = req.body;
      if (!type || !['income', 'expense'].includes(type) || typeof category !== 'string' || category.trim().length === 0 || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: '参数无效' });
      }
      let insertResult;
      if (date !== undefined && date !== null) {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          const iso = parsed.toISOString();
          insertResult = await db.run(
            `INSERT INTO transactions (user_id, type, category, amount, description, date, is_voice_input, voice_input_text, tags, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [userId, type, category, amount, description || null, iso, is_voice_input ? 1 : 0, voice_input_text || null, Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null)]
          );
        } else { return res.status(400).json({ error: '无效的日期格式' }); }
      } else {
        insertResult = await db.run(
          `INSERT INTO transactions (user_id, type, category, amount, description, is_voice_input, voice_input_text, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [userId, type, category, amount, description || null, is_voice_input ? 1 : 0, voice_input_text || null, Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null)]
        );
      }
      const newRow = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [insertResult.lastID, userId]);
      res.status(201).json(newRow);
    } catch (err) { return next(err); }
  });

  router.post('/transactions/bulk', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const items = req.body && Array.isArray(req.body.transactions) ? req.body.transactions : null;
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'transactions 不能为空' });
      }
      if (items.length > 200) {
        return res.status(400).json({ error: '一次最多创建 200 条交易' });
      }

      const normalized = [];
      for (const item of items) {
        const type = item && item.type;
        const category = item && item.category;
        const amount = item && item.amount;
        const description = item && item.description;
        const date = item && item.date;
        const is_voice_input = item && item.is_voice_input;
        const voice_input_text = item && item.voice_input_text;
        const tags = item && item.tags;

        if (!type || !['income', 'expense'].includes(type) || typeof category !== 'string' || category.trim().length === 0 || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ error: '参数无效' });
        }

        let isoDate = new Date().toISOString();
        if (date !== undefined && date !== null) {
          const parsed = new Date(date);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({ error: '无效的日期格式' });
          }
          isoDate = parsed.toISOString();
        }

        normalized.push({
          type,
          category,
          amount,
          description: description || null,
          date: isoDate,
          is_voice_input: is_voice_input ? 1 : 0,
          voice_input_text: voice_input_text || null,
          tags: Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null)
        });
      }

      const created = [];
      await db.run('BEGIN');
      try {
        const stmt = await db.prepare(
          `INSERT INTO transactions (user_id, type, category, amount, description, date, is_voice_input, voice_input_text, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        );

        for (const tx of normalized) {
          const result = await stmt.run([
            userId,
            tx.type,
            tx.category,
            tx.amount,
            tx.description,
            tx.date,
            tx.is_voice_input,
            tx.voice_input_text,
            tx.tags
          ]);
          const row = await db.get(
            'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [result.lastID, userId]
          );
          created.push(row);
        }

        await stmt.finalize();
        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
        throw e;
      }

      res.status(201).json({ transactions: created });
    } catch (err) { return next(err); }
  });

  router.put('/transactions/:id', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { type, category, amount, description, date, is_voice_input, voice_input_text, tags } = req.body;
      if (!type || !['income', 'expense'].includes(type) || typeof category !== 'string' || category.trim().length === 0 || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: '参数无效' });
      }
      if (typeof tags !== 'undefined' && tags !== null && !Array.isArray(tags) && typeof tags !== 'string') {
        return res.status(400).json({ error: 'tags 参数无效' });
      }
      const existing = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, userId]);
      if (!existing) return res.status(404).json({ error: '交易记录不存在' });
      let updateDate = existing.date;
      if (date !== undefined && date !== null) {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) updateDate = parsed.toISOString(); else return res.status(400).json({ error: '无效的日期格式' });
      }

      const setClauses = [
        'type = ?',
        'category = ?',
        'amount = ?',
        'description = ?',
        'date = ?',
        'is_voice_input = ?',
        'voice_input_text = ?',
      ];
      const params = [
        type,
        category,
        amount,
        description || null,
        updateDate,
        is_voice_input ? 1 : 0,
        voice_input_text || null,
      ];

      // Allow explicit clearing of tags by sending `null`.
      if (typeof tags !== 'undefined') {
        setClauses.push('tags = ?');
        params.push(Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : null));
      }

      setClauses.push("updated_at = datetime('now')");

      await db.run(
        `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [...params, id, userId]
      );
      const updated = await db.get('SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, userId]);
      res.json(updated);
    } catch (err) { return next(err); }
  });

  router.delete('/transactions/:id', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const result = await db.run(
        'UPDATE transactions SET deleted_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [id, userId]
      );
      if (result.changes === 0) return res.status(404).json({ error: '交易记录不存在' });
      res.status(204).send();
    } catch (err) { return next(err); }
  });

  return router;
};


