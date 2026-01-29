'use strict';

const express = require('express');
const { toUnixMs } = require('../utils/uiFormat');

function toPositiveIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseCursor(cursor) {
  const raw = typeof cursor === 'string' ? cursor.trim() : '';
  if (!raw) return null;

  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : '';
    const id = Number(parsed.id);
    if (createdAt && Number.isInteger(id) && id > 0) return { createdAt, id };
  } catch {}

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

function styleForType(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'success') return { color: '#52c41a', variant: 'success' };
  if (t === 'warning') return { color: '#faad14', variant: 'warning' };
  return { color: '#ff4d4f', variant: 'error' };
}

function normalizeRow(row) {
  const r = row && typeof row === 'object' ? row : {};
  let data = null;
  if (r.data_json) {
    try { data = JSON.parse(String(r.data_json)); } catch { data = null; }
  }
  const createdAt = r.created_at ? String(r.created_at) : null;
  return {
    id: Number(r.id),
    type: r.type ? String(r.type) : 'success',
    title: r.title ? String(r.title) : '',
    message: r.message ? String(r.message) : '',
    data,
    readAt: r.read_at ? String(r.read_at) : null,
    createdAt,
    timestamp: createdAt ? toUnixMs(createdAt) : null,
    style: styleForType(r.type),
  };
}

module.exports = function notificationsRouter(db) {
  const router = express.Router();

  // GET /api/notifications - list notification history
  router.get('/notifications', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const limit = Math.min(toPositiveIntOrNull(req.query.limit) || 50, 200);
      const cursor = parseCursor(req.query.cursor);
      const unreadOnly = String(req.query.unreadOnly || '') === '1';

      const where = ['user_id = ?', 'deleted_at IS NULL'];
      const params = [userId];
      if (unreadOnly) where.push('read_at IS NULL');
      if (cursor) {
        where.push('(created_at < ? OR (created_at = ? AND id < ?))');
        params.push(cursor.createdAt, cursor.createdAt, cursor.id);
      }

      const rows = await db.all(
        `SELECT id, user_id, type, title, message, data_json, read_at, created_at
         FROM notifications
         WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [...params, limit]
      );

      const notifications = (Array.isArray(rows) ? rows : []).map(normalizeRow);
      const nextCursor = notifications.length === limit ? makeCursor(rows[rows.length - 1]) : null;

      res.json({
        notifications,
        pageInfo: {
          limit,
          nextCursor,
          hasMore: Boolean(nextCursor),
        }
      });
    } catch (err) { return next(err); }
  });

  // POST /api/notifications - create a notification (for system or UI)
  router.post('/notifications', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const body = req.body || {};

      const typeRaw = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
      const type = ['success', 'warning', 'error'].includes(typeRaw) ? typeRaw : null;
      if (!type) return res.status(400).json({ error: 'type 无效（success|warning|error）' });

      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
      const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
      if (!message) return res.status(400).json({ error: 'message 不能为空' });

      let dataJson = null;
      if (body.data !== undefined && body.data !== null) {
        try {
          const s = JSON.stringify(body.data);
          if (s.length > 10_000) return res.status(400).json({ error: 'data 过大' });
          dataJson = s;
        } catch {
          return res.status(400).json({ error: 'data 必须可序列化为 JSON' });
        }
      }

      const result = await db.run(
        `INSERT INTO notifications (user_id, type, title, message, data_json, read_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'), NULL)`,
        [userId, type, title || null, message, dataJson]
      );

      const row = await db.get(
        `SELECT id, user_id, type, title, message, data_json, read_at, created_at
         FROM notifications
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [result.lastID, userId]
      );

      res.status(201).json(normalizeRow(row));
    } catch (err) { return next(err); }
  });

  // POST /api/notifications/:id/read - mark as read
  router.post('/notifications/:id/read', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id 无效' });

      const result = await db.run(
        `UPDATE notifications
         SET read_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [id, userId]
      );

      if (!result || result.changes === 0) return res.status(404).json({ error: '通知不存在' });

      const row = await db.get(
        `SELECT id, user_id, type, title, message, data_json, read_at, created_at
         FROM notifications
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [id, userId]
      );

      res.json(normalizeRow(row));
    } catch (err) { return next(err); }
  });

  return router;
};

