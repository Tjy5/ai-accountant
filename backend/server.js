const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// 设置环境变量来禁用 dotenv 提示
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.DOTENV_CONFIG_SILENT = 'true';
// 加载环境变量
require('dotenv').config();

// Production safety checks (fail fast instead of running with insecure defaults)
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
  if (!jwtSecret) {
    console.error('❌ Missing required env: JWT_SECRET (required in production)');
    process.exit(1);
  }

  const encryptionKey = typeof process.env.ENCRYPTION_KEY === 'string' ? process.env.ENCRYPTION_KEY.trim() : '';
  if (!encryptionKey) {
    console.error('❌ Missing required env: ENCRYPTION_KEY (required in production)');
    process.exit(1);
  }
}

const app = express();
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const authRouterFactory = require('./routes/auth');
const budgetsRouterFactory = require('./routes/budgets');
const categoriesRouterFactory = require('./routes/categories');
const transactionsRouterFactory = require('./routes/transactions');
const dashboardRouterFactory = require('./routes/dashboard');
const preferencesRouterFactory = require('./routes/preferences');
const aiSettingsRouterFactory = require('./routes/aiSettings');
const aiRouterFactory = require('./routes/ai');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// 设置编码和字符集
app.use(cors());
app.use(morgan('combined'));

// Compress responses (skip SSE)
app.use(compression({
  filter: (req, res) => {
    const accept = typeof req.headers.accept === 'string' ? req.headers.accept : '';
    if (accept.includes('text/event-stream')) return false;
    if (req.path === '/api/ai/chat' && (String(req.query?.stream || '') === '1' || String(req.query?.stream || '') === 'true')) return false;
    return compression.filter(req, res);
  }
}));

// Request body size limits (backward compatible defaults).
// - Most endpoints are small JSON, but keep 10mb default to avoid breaking existing clients.
// - AI endpoints need larger payloads for base64 image/audio.
const jsonLimit = process.env.JSON_LIMIT || '10mb';
const aiJsonLimit = process.env.AI_JSON_LIMIT || jsonLimit;
app.use('/api/ai', express.json({ limit: aiJsonLimit }));
app.use('/api/ai', express.urlencoded({ extended: true, limit: aiJsonLimit }));
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonLimit }));

// 简单限流：每个 IP 每 15 分钟 1000 次调用
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

let db;
// 初始化数据库并运行迁移
(async () => {
  try {
    db = await open({
      filename: process.env.DATABASE_FILE || './database.sqlite',
      driver: sqlite3.Database
    });

    // SQLite connection PRAGMA (explicit, so behavior is consistent across environments)
    try { await db.exec('PRAGMA foreign_keys = ON;'); } catch {}
    try { await db.exec('PRAGMA journal_mode = WAL;'); } catch {}
    try { await db.exec('PRAGMA synchronous = NORMAL;'); } catch {}
    try { await db.exec('PRAGMA busy_timeout = 5000;'); } catch {}

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
    app.use('/api', dashboardRouterFactory(db));
    app.use('/api', preferencesRouterFactory(db));
    app.use('/api', aiSettingsRouterFactory(db));
    app.use('/api', aiRouterFactory(db));

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
