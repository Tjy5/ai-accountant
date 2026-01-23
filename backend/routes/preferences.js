'use strict';

const express = require('express');

module.exports = function preferencesRouter(db) {
  const router = express.Router();

  // POST /api/preferences - 用户偏好上报接口
  router.post('/preferences', async (req, res, next) => {
    try {
      const { keyword, category } = req.body;

      if (!keyword || !category) {
        return res.status(400).json({ error: '请提供关键词和分类' });
      }

      // 这里可以存储用户偏好到数据库
      // 暂时只返回成功响应
      res.json({ message: '偏好已记录' });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
