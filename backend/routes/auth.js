'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { signToken } = require('../utils/jwt');
const authMiddleware = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

module.exports = function authRouter(db) {
  const router = express.Router();

  // 邮箱验证函数
  const isValidEmail = (email) => {
    const e = typeof email === 'string' ? email.trim() : '';
    if (!e) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(e);
  };

  // 密码强度验证函数
  const isStrongPassword = (password) => {
    if (typeof password !== 'string') return { valid: false, error: '密码格式不正确' };
    if (password.length < 8) return { valid: false, error: '密码长度至少为 8 位' };
    return { valid: true };
  };

  async function seedDefaultCategoriesForUser(userId) {
    if (!userId) return;

    try {
      const existingRow = await db.get(
        'SELECT COUNT(*) AS cnt FROM categories WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
      );
      const existingCount = Number(existingRow && existingRow.cnt ? existingRow.cnt : 0);
      if (existingCount > 0) return;

      let defaults = [];
      try {
        const rows = await db.all(
          `SELECT name, type, icon, color, description
             FROM categories
            WHERE user_id IS NULL AND deleted_at IS NULL AND is_default = 1
            ORDER BY id`
        );
        defaults = Array.isArray(rows) ? rows : [];
      } catch {
        defaults = [];
      }

      if (defaults.length === 0) {
        defaults = [
          { name: '餐饮', type: 'expense', icon: 'ShoppingOutlined', color: '#ff4d4f', description: '日常餐饮消费' },
          { name: '交通', type: 'expense', icon: 'CarOutlined', color: '#1890ff', description: '公共交通、打车等' },
          { name: '购物', type: 'expense', icon: 'ShoppingOutlined', color: '#52c41a', description: '日常用品购买' },
          { name: '工资', type: 'income', icon: 'DollarOutlined', color: '#52c41a', description: '工资收入' },
          { name: '奖金', type: 'income', icon: 'TrophyOutlined', color: '#faad14', description: '奖金、红包等' },
        ];
      }

      if (!defaults.some((d) => String(d && d.name ? d.name : '').trim() === '其他')) {
        defaults.push({ name: '其他', type: 'both', icon: 'AppstoreOutlined', color: '#8c8c8c', description: '其他收入或支出' });
      }

      for (const d of defaults) {
        const name = String(d && d.name ? d.name : '').trim();
        const type = d && d.type ? String(d.type) : '';
        if (!name) continue;
        if (!['income', 'expense', 'both'].includes(type)) continue;
        await db.run(
          `INSERT OR IGNORE INTO categories (user_id, name, type, icon, color, description, is_default, usage_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))`,
          [userId, name, type, d.icon || null, d.color || null, d.description || null]
        );
      }
    } catch (err) {
      // Don't fail registration if seeding fails; users can still create categories manually.
      console.warn('⚠️ Failed to seed default categories for user:', err && err.message ? err.message : err);
    }
  }

  // POST /api/auth/register - 用户注册
  router.post('/register', registerLimiter, async (req, res, next) => {
    try {
      const { email, password, name } = req.body;

      // 验证必填字段
      if (!email || !password) {
        return res.status(400).json({ error: '邮箱和密码为必填项' });
      }

      // 验证邮箱格式
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
      }

      // 验证密码强度
      const passwordCheck = isStrongPassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.error });
      }

      // 检查邮箱是否已存在
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) {
        return res.status(409).json({ error: '该邮箱已被注册' });
      }

      // 创建用户
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await db.run(
        `INSERT INTO users (email, password_hash, name, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [email, passwordHash, name || null]
      );

      const user = await db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [result.lastID]);

      // Ensure new users have usable categories (fixes legacy default categories seeded without user_id).
      await seedDefaultCategoriesForUser(user.id);
      const token = signToken(user);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        },
        token
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/auth/login - 用户登录
  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // 验证必填字段
      if (!email || !password) {
        return res.status(400).json({ error: '邮箱和密码为必填项' });
      }

      // 只查询必要的字段
      const user = await db.get(
        'SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }

      const token = signToken(user);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        },
        token
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/auth/me - 获取当前用户信息
  router.get('/me', authMiddleware, async (req, res, next) => {
    try {
      const user = await db.get(
        'SELECT id, email, name, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      res.json({ user });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
