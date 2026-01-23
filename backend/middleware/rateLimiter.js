'use strict';

// 简单的内存速率限制器
// 生产环境建议使用 express-rate-limit 或 Redis

class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 5) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();

      // 清理过期记录
      this.cleanup(now);

      // 获取当前窗口的请求记录
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const userRequests = this.requests.get(key);
      const recentRequests = userRequests.filter(time => now - time < this.windowMs);

      if (recentRequests.length >= this.maxRequests) {
        const oldestRequest = Math.min(...recentRequests);
        const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);

        res.set('Retry-After', retryAfter);
        return res.status(429).json({
          error: '请求过于频繁，请稍后再试',
          retryAfter: retryAfter
        });
      }

      // 记录本次请求
      recentRequests.push(now);
      this.requests.set(key, recentRequests);

      next();
    };
  }

  getKey(req) {
    // 优先使用 IP 地址，如果有用户信息则使用用户 ID
    return req.user?.id || req.ip || req.connection.remoteAddress;
  }

  cleanup(now) {
    // 定期清理过期的记录
    for (const [key, times] of this.requests.entries()) {
      const validTimes = times.filter(time => now - time < this.windowMs);
      if (validTimes.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimes);
      }
    }
  }
}

// 导出不同场景的限制器
module.exports = {
  // 登录限制: 15分钟内最多5次
  loginLimiter: new RateLimiter(15 * 60 * 1000, 5).middleware(),

  // 注册限制: 1小时内最多3次
  registerLimiter: new RateLimiter(60 * 60 * 1000, 3).middleware(),

  // 通用 API 限制: 15分钟内最多100次
  apiLimiter: new RateLimiter(15 * 60 * 1000, 100).middleware()
};
