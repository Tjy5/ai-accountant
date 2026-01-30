'use strict';

const express = require('express');
const { TtlCache } = require('../utils/ttlCache');

function toYmdLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toYmdLocal(start), endDate: toYmdLocal(end) };
}

function parseYmd(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return m[0];
}

function toPositiveIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

module.exports = function dashboardRouter(db) {
  const router = express.Router();

  const responseCache = new TtlCache({ maxItems: 5000, defaultTtlMs: 15_000 });

  function getRangeFromQuery(req) {
    const defaults = getDefaultRange();
    const startDate = parseYmd(req.query.startDate) || defaults.startDate;
    const endDate = parseYmd(req.query.endDate) || defaults.endDate;
    if (!startDate || !endDate) return { error: 'startDate/endDate 无效' };
    if (endDate < startDate) return { error: 'endDate 不能早于 startDate' };
    return { startDate, endDate };
  }

  // GET /api/dashboard/summary
  router.get('/dashboard/summary', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const range = getRangeFromQuery(req);
      if (range.error) return res.status(400).json({ error: range.error });

      const cacheKey = `summary:${userId}:${range.startDate}:${range.endDate}`;
      const bypassCache = String(req.query.cache || '') === '0';
      if (!bypassCache) {
        const cached = responseCache.get(cacheKey);
        if (cached) return res.json({ ...cached, cache: { hit: true } });
      }

      const row = await db.get(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
           COUNT(*) as count,
           MAX(COALESCE(updated_at, created_at)) as updated_at
         FROM transactions
         WHERE user_id = ?
           AND deleted_at IS NULL
           AND DATE(date) >= DATE(?)
           AND DATE(date) <= DATE(?)`,
        [userId, range.startDate, range.endDate]
      );

      const income = Number(row?.income) || 0;
      const expense = Number(row?.expense) || 0;
      const net = income - expense;
      const count = Number(row?.count) || 0;
      const updatedAt = row?.updated_at ? String(row.updated_at) : null;

      const payload = {
        range,
        totals: {
          income,
          expense,
          net,
          count,
        },
        updatedAt,
        timestamp: Date.now(),
        cache: { hit: false },
      };

      responseCache.set(cacheKey, payload);
      res.json(payload);
    } catch (err) { return next(err); }
  });

  // GET /api/dashboard/charts
  router.get('/dashboard/charts', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const range = getRangeFromQuery(req);
      if (range.error) return res.status(400).json({ error: range.error });

      const topN = Math.min(toPositiveIntOrNull(req.query.topN) || 10, 50);
      const cacheKey = `charts:${userId}:${range.startDate}:${range.endDate}:${topN}`;
      const bypassCache = String(req.query.cache || '') === '0';
      if (!bypassCache) {
        const cached = responseCache.get(cacheKey);
        if (cached) return res.json({ ...cached, cache: { hit: true } });
      }

      const [trendRows, shareRows] = await Promise.all([
        db.all(
          `SELECT strftime('%Y-%m', DATE(date)) as month, type, COALESCE(SUM(amount), 0) as total
           FROM transactions
           WHERE user_id = ?
             AND deleted_at IS NULL
             AND DATE(date) >= DATE(?)
             AND DATE(date) <= DATE(?)
           GROUP BY month, type
           ORDER BY month ASC`,
          [userId, range.startDate, range.endDate]
        ),
        db.all(
          `SELECT category, COALESCE(SUM(amount), 0) as total
           FROM transactions
           WHERE user_id = ?
             AND deleted_at IS NULL
             AND type = 'expense'
             AND DATE(date) >= DATE(?)
             AND DATE(date) <= DATE(?)
           GROUP BY category
           ORDER BY total DESC
           LIMIT ?`,
          [userId, range.startDate, range.endDate, topN]
        ),
      ]);

      const byMonth = new Map();
      for (const r of Array.isArray(trendRows) ? trendRows : []) {
        const month = r && r.month ? String(r.month) : '';
        const type = r && r.type ? String(r.type) : '';
        if (!month || (type !== 'income' && type !== 'expense')) continue;
        const total = Number(r.total) || 0;
        const cur = byMonth.get(month) || { month, income: 0, expense: 0 };
        cur[type] = total;
        byMonth.set(month, cur);
      }

      const monthlyTrend = Array.from(byMonth.values()).map((m) => {
        const income = Number(m.income) || 0;
        const expense = Number(m.expense) || 0;
        const net = income - expense;
        return {
          month: m.month,
          income,
          expense,
          net,
        };
      });

      const totalExpense = (Array.isArray(shareRows) ? shareRows : [])
        .reduce((sum, r) => sum + (Number(r?.total) || 0), 0);

      const categoryShare = (Array.isArray(shareRows) ? shareRows : []).map((r) => {
        const category = r && r.category ? String(r.category) : '';
        const total = Number(r?.total) || 0;
        const pct = totalExpense > 0 ? total / totalExpense : 0;
        return {
          category,
          total,
          percentage: Number(pct.toFixed(4)),
        };
      });

      const payload = {
        range,
        monthlyTrend,
        categoryShare,
        timestamp: Date.now(),
        cache: { hit: false },
      };

      responseCache.set(cacheKey, payload);
      res.json(payload);
    } catch (err) { return next(err); }
  });

  return router;
};
