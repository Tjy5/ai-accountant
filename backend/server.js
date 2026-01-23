const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// 设置环境变量来禁用 dotenv 提示
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.DOTENV_CONFIG_SILENT = 'true';
// 加载环境变量
require('dotenv').config();

const app = express();
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const authRouterFactory = require('./routes/auth');
const budgetsRouterFactory = require('./routes/budgets');
const categoriesRouterFactory = require('./routes/categories');
const transactionsRouterFactory = require('./routes/transactions');
const syncRouterFactory = require('./routes/sync');
const devicesRouterFactory = require('./routes/devices');
const preferencesRouterFactory = require('./routes/preferences');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// 设置编码和字符集
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 简单限流：每个 IP 每 15 分钟 1000 次调用
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// 设置响应头编码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

let db;
// 初始化数据库并运行迁移
(async () => {
  try {
    db = await open({
      filename: process.env.DATABASE_FILE || './database.sqlite',
      driver: sqlite3.Database
    });

    // 检查是否需要运行数据库迁移
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // 运行数据库迁移
      const { stdout } = await execAsync('npm run migrate', { cwd: __dirname });
      if (stdout && stdout.trim().length > 0) {
        console.log(stdout.trim());
      }
    } catch (migrationError) {
      console.log('⚠️ 迁移可能已经运行过或出现非致命错误，继续启动服务器...');
    }

    // 路由配置（确保在 db 初始化后注册）
    // Public auth routes
    app.use('/api/auth', authRouterFactory(db));

    // Protected business APIs
    app.use('/api', authMiddleware);
    app.use('/api', budgetsRouterFactory(db));
    app.use('/api', categoriesRouterFactory(db));
    app.use('/api', transactionsRouterFactory(db));
    app.use('/api', syncRouterFactory(db));
    app.use('/api', devicesRouterFactory(db));
    app.use('/api', preferencesRouterFactory(db));

    const server = app.listen(process.env.PORT || 3001, () => {
      console.log(`🚀 服务器已启动，监听端口 ${process.env.PORT || 3001}`);
    });

    // 添加错误处理，确保服务器持续运行
    server.on('error', (err) => {
      console.error('❌ 服务器错误:', err);
    });

    // 优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务器...');
      server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ 数据库初始化失败:', err);
    process.exit(1);
  }
})();

// 错误处理中间件
app.use(errorHandler);

module.exports = app;
