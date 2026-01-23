'use strict';

const express = require('express');

module.exports = function devicesRouter(db) {
  const router = express.Router();

  // POST /api/devices/register - 注册设备 token
  router.post('/devices/register', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { token, platform } = req.body;

      if (!token || !platform) {
        return res.status(400).json({ error: '缺少必填字段: token 和 platform' });
      }

      // 检查设备是否已存在
      const existing = await db.get(
        'SELECT id FROM devices WHERE user_id = ? AND device_token = ?',
        [userId, token]
      );

      if (existing) {
        // 更新最后同步时间
        await db.run(
          'UPDATE devices SET last_sync_at = datetime(\'now\') WHERE id = ?',
          [existing.id]
        );
        return res.json({ message: '设备已存在，已更新同步时间' });
      }

      // 插入新设备
      await db.run(
        `INSERT INTO devices (user_id, device_token, platform, last_sync_at, created_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        [userId, token, platform]
      );

      res.status(201).json({ message: '设备注册成功' });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
