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
      const { keyword, category } = req.body || {};

      const k = typeof keyword === 'string' ? keyword.trim() : '';
      const c = typeof category === 'string' ? category.trim() : '';

      if (!k || !c) {
        return res.status(400).json({ error: '请提供关键词和分类' });
      }

      // Upsert: if keyword exists, update category; otherwise insert new row
      const existing = await db.get(
        'SELECT id FROM user_preferences WHERE user_id = ? AND keyword = ?',
        [userId, k]
      );

      if (existing && existing.id) {
        await db.run(
          `UPDATE user_preferences
           SET category = ?, deleted_at = NULL, updated_at = datetime('now')
           WHERE id = ?`,
          [c, existing.id]
        );

        const preference = await db.get(
          'SELECT id, keyword, category, created_at, updated_at FROM user_preferences WHERE id = ?',
          [existing.id]
        );

        return res.status(200).json({ preference });
      }

      const result = await db.run(
        `INSERT INTO user_preferences (user_id, keyword, category, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'), NULL)`,
        [userId, k, c]
      );

      const preference = await db.get(
        'SELECT id, keyword, category, created_at, updated_at FROM user_preferences WHERE id = ?',
        [result.lastID]
      );

      return res.status(201).json({ preference });
    } catch (err) {
      return next(err);
    }
  });

  // ===== UI Preferences =====
  // GET /api/user/preferences - 获取 UI 偏好（主题/动画/AI 助手显示）
  router.get('/user/preferences', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const row = await db.get(
        `SELECT theme, animations_enabled, ai_assistant_visible, updated_at
         FROM user_ui_preferences
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );

      const theme = row && typeof row.theme === 'string' ? row.theme : 'system';
      const animationsEnabled = row ? Boolean(row.animations_enabled) : true;
      const aiAssistantVisible = row ? Boolean(row.ai_assistant_visible) : true;

      res.json({
        preferences: { theme, animationsEnabled, aiAssistantVisible },
        updatedAt: row?.updated_at || null,
        timestamp: Date.now(),
      });
    } catch (err) { return next(err); }
  });

  // PUT /api/user/preferences - 更新 UI 偏好
  router.put('/user/preferences', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const body = req.body || {};

      const themeRaw = body.theme !== undefined ? String(body.theme || '').trim().toLowerCase() : null;
      const theme = themeRaw && ['light', 'dark', 'system'].includes(themeRaw) ? themeRaw : null;

      const animationsEnabledIn = body.animationsEnabled ?? body.animations_enabled;
      const aiAssistantVisibleIn = body.aiAssistantVisible ?? body.ai_assistant_visible;

      const toBool = (v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
        return null;
      };

      const animationsEnabled = animationsEnabledIn !== undefined ? toBool(animationsEnabledIn) : null;
      const aiAssistantVisible = aiAssistantVisibleIn !== undefined ? toBool(aiAssistantVisibleIn) : null;

      if (theme === null && animationsEnabled === null && aiAssistantVisible === null) {
        return res.status(400).json({ error: '没有可更新的字段' });
      }

      const existing = await db.get(
        'SELECT id FROM user_ui_preferences WHERE user_id = ?',
        [userId]
      );

      if (!existing) {
        await db.run(
          `INSERT INTO user_ui_preferences (user_id, theme, animations_enabled, ai_assistant_visible, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), NULL)`,
          [
            userId,
            theme || 'system',
            animationsEnabled === null ? 1 : (animationsEnabled ? 1 : 0),
            aiAssistantVisible === null ? 1 : (aiAssistantVisible ? 1 : 0),
          ]
        );
      } else {
        const setClauses = [];
        const params = [];
        if (theme !== null) { setClauses.push('theme = ?'); params.push(theme); }
        if (animationsEnabled !== null) { setClauses.push('animations_enabled = ?'); params.push(animationsEnabled ? 1 : 0); }
        if (aiAssistantVisible !== null) { setClauses.push('ai_assistant_visible = ?'); params.push(aiAssistantVisible ? 1 : 0); }
        setClauses.push('deleted_at = NULL');
        setClauses.push('updated_at = datetime(\'now\')');

        await db.run(
          `UPDATE user_ui_preferences SET ${setClauses.join(', ')} WHERE user_id = ?`,
          [...params, userId]
        );
      }

      const row = await db.get(
        `SELECT theme, animations_enabled, ai_assistant_visible, updated_at
         FROM user_ui_preferences
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );

      res.json({
        preferences: {
          theme: row && typeof row.theme === 'string' ? row.theme : 'system',
          animationsEnabled: row ? Boolean(row.animations_enabled) : true,
          aiAssistantVisible: row ? Boolean(row.ai_assistant_visible) : true,
        },
        updatedAt: row?.updated_at || null,
        timestamp: Date.now(),
      });
    } catch (err) { return next(err); }
  });

  return router;
};
