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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 密码强度验证函数
  const isStrongPassword = (password) => {
    if (password.length < 8) return { valid: false, error: '密码长度至少为 8 位' };
    if (!/[A-Z]/.test(password)) return { valid: false, error: '密码必须包含至少一个大写字母' };
    if (!/[a-z]/.test(password)) return { valid: false, error: '密码必须包含至少一个小写字母' };
    if (!/[0-9]/.test(password)) return { valid: false, error: '密码必须包含至少一个数字' };
    return { valid: true };
  };

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

      // 验证邮箱格式
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: '邮箱格式不正确' });
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
