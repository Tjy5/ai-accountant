'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { signToken } = require('../utils/jwt');
const authMiddleware = require('../middleware/auth');

module.exports = function authRouter(db) {
  const router = express.Router();

  // POST /api/auth/register - 用户注册
  router.post('/register', async (req, res, next) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: '邮箱和密码为必填项' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度至少为 6 位' });
      }

      const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) {
        return res.status(409).json({ error: '该邮箱已被注册' });
      }

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
  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: '邮箱和密码为必填项' });
      }

      const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
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
