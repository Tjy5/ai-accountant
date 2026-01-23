'use strict';

const { verifyToken } = require('../utils/jwt');

module.exports = function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    req.user = {
      id: parseInt(decoded.sub, 10),
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '令牌已过期', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的令牌', code: 'INVALID_TOKEN' });
    }
    return res.status(401).json({ error: '认证失败' });
  }
};
