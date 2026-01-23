const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const chrono = require('chrono-node');
const { toArabicString } = require('chinese-numbers-to-arabic');
const multer = require('multer');
const XLSX = require('xlsx');
const { parseTransactionRow, insertTransactions, parseWorkbook } = require('./services/importService');


// 设置环境变量来禁用 dotenv 提示
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.DOTENV_CONFIG_SILENT = 'true';
// 加载环境变量
require('dotenv').config();

const app = express();
// const naturalLanguageModel = new NaturalLanguageExpenseModel();
const errorHandler = require('./middleware/errorHandler');
const budgetsRouterFactory = require('./routes/budgets');
const categoriesRouterFactory = require('./routes/categories');
const transactionsRouterFactory = require('./routes/transactions');
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

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/csv' ||
      file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 Excel (.xlsx, .xls) 和 CSV 文件'));
    }
  }
});

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
    app.use('/api', budgetsRouterFactory(db));
    app.use('/api', categoriesRouterFactory(db));
    app.use('/api', transactionsRouterFactory(db));

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

// 注意：其他直接依赖 db 的路由已在上面成功连接数据库后注册

// 获取交易记录
app.get('/api/transactions', async (req, res) => {
  try {
    const {
      keyword,
      type,
      startDate,
      endDate,
      category,
      minAmount,
      maxAmount,
      description,
      tag,
      page = 1,
      limit = 50,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // 构建查询条件
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (keyword) {
      conditions.push(`(description LIKE ? OR voice_input_text LIKE ?)`);
      params.push(`%${keyword}%`, `%${keyword}%`);
      paramIndex += 2;
    }

    if (type && type !== 'all') {
      conditions.push(`type = ?`);
      params.push(type);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`date >= ?`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`date <= ?`);
      params.push(endDate);
      paramIndex++;
    }

    if (category && category.length > 0) {
      if (Array.isArray(category)) {
        const placeholders = category.map(() => '?').join(',');
        conditions.push(`category IN (${placeholders})`);
        params.push(...category);
        paramIndex += category.length;
      } else {
        conditions.push(`category = ?`);
        params.push(category);
        paramIndex++;
      }
    }

    if (minAmount !== undefined && minAmount !== '') {
      conditions.push(`amount >= ?`);
      params.push(parseFloat(minAmount));
      paramIndex++;
    }

    if (maxAmount !== undefined && maxAmount !== '') {
      conditions.push(`amount <= ?`);
      params.push(parseFloat(maxAmount));
      paramIndex++;
    }

    if (description) {
      conditions.push(`description LIKE ?`);
      params.push(`%${description}%`);
      paramIndex++;
    }

    if (tag && tag.length > 0) {
      if (Array.isArray(tag)) {
        const tagConditions = tag.map(() => `tags LIKE ?`).join(' OR ');
        conditions.push(`(${tagConditions})`);
        tag.forEach(t => params.push(`%${t}%`));
        paramIndex += tag.length;
      } else {
        conditions.push(`tags LIKE ?`);
        params.push(`%${tag}%`);
        paramIndex++;
      }
    }

    // 构建 WHERE 子句
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 验证排序字段
    const allowedSortFields = ['date', 'amount', 'created_at', 'type', 'category'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'date';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 计算分页
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitValue = parseInt(limit);

    // 构建最终查询
    const finalQuery = `
      SELECT * FROM transactions 
      ${whereClause}
      ORDER BY ${sortField} ${orderDirection}
      LIMIT ? OFFSET ?
    `;

    // 执行查询
    const transactions = await db.all(finalQuery, ...params, limitValue, offset);

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM transactions ${whereClause}`;
    const { total } = await db.get(countQuery, ...params);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: limitValue,
        total: parseInt(total),
        pages: Math.ceil(total / limitValue)
      }
    });

  } catch (error) {
    console.error('❌ 获取交易记录失败:', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

// 创建交易记录
app.post('/api/transactions', async (req, res) => {
  try {
    const { type, category, amount, description, date, is_voice_input, voice_input_text, tags } = req.body;

    // 验证必填字段
    if (!type || !category || !amount || !date) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 验证类型
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 income 或 expense' });
    }

    // 验证金额
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: '金额必须是正数' });
    }

    // 处理标签
    let tagsString = null;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      tagsString = JSON.stringify(tags);
    }

    const result = await db.run(`
      INSERT INTO transactions (type, category, amount, description, date, is_voice_input, voice_input_text, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [type, category, numAmount, description, date, is_voice_input ? 1 : 0, voice_input_text, tagsString]);

    res.status(201).json({
      id: result.lastID,
      type,
      category,
      amount: numAmount,
      description,
      date,
      is_voice_input,
      voice_input_text,
      tags
    });

  } catch (error) {
    console.error('❌ 创建交易记录失败:', error);
    res.status(500).json({ error: '创建交易记录失败' });
  }
});

// 更新交易记录
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, category, amount, description, date, tags } = req.body;

    // 验证必填字段
    if (!type || !category || !amount || !date) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 验证类型
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: '类型必须是 income 或 expense' });
    }

    // 验证金额
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: '金额必须是正数' });
    }

    // 处理标签
    let tagsString = null;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      tagsString = JSON.stringify(tags);
    }

    const result = await db.run(`
      UPDATE transactions 
      SET type = ?, category = ?, amount = ?, description = ?, date = ?, tags = ?
      WHERE id = ?
    `, [type, category, numAmount, description, date, tagsString, id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: '交易记录不存在' });
    }

    res.json({
      id: parseInt(id),
      type,
      category,
      amount: numAmount,
      description,
      date,
      tags
    });

  } catch (error) {
    console.error('❌ 更新交易记录失败:', error);
    res.status(500).json({ error: '更新交易记录失败' });
  }
});

// 删除交易记录
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.run('DELETE FROM transactions WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: '交易记录不存在' });
    }

    res.json({ message: '删除成功' });

  } catch (error) {
    console.error('❌ 删除交易记录失败:', error);
    res.status(500).json({ error: '删除交易记录失败' });
  }
});

// 文本分析接口 - 已移除
// app.post('/api/analyze-text', async (req, res) => { ... });

// 用户偏好上报接口
app.post('/api/preferences', async (req, res) => {
  try {
    const { keyword, category } = req.body;

    if (!keyword || !category) {
      return res.status(400).json({ error: '请提供关键词和分类' });
    }

    // 这里可以存储用户偏好到数据库
    // 暂时只返回成功响应
    res.json({ message: '偏好已记录' });

  } catch (error) {
    console.error('❌ 记录用户偏好失败:', error);
    res.status(500).json({ error: '记录用户偏好失败' });
  }
});

// 文件导入接口
app.post('/api/transactions/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const { originalname, buffer } = req.file;
    let workbook;
    let parseError = null;

    try {
      if (originalname.endsWith('.csv')) {
        // 处理 CSV 文件
        const csvContent = buffer.toString('utf-8');
        workbook = XLSX.read(csvContent, { type: 'string' });
      } else {
        // 处理 Excel 文件
        workbook = XLSX.read(buffer, { type: 'buffer' });
      }
    } catch (error) {
      parseError = error;
    }

    if (parseError) {
      console.error('❌ 文件解析失败:', parseError);
      return res.status(400).json({ error: '文件格式不支持或文件损坏' });
    }

    // 解析工作簿
    const result = parseWorkbook(workbook);

    if (result.errors.length > 0) {
      return res.status(400).json({
        error: '文件解析失败',
        details: result.errors
      });
    }

    // 插入数据到数据库
    const insertResult = await insertTransactions(db, result.transactions);

    res.json({
      message: '导入成功',
      imported: insertResult.successCount,
      failed: insertResult.errorCount,
      errors: insertResult.errors
    });

  } catch (error) {
    console.error('❌ 文件导入失败:', error);
    res.status(500).json({ error: '文件导入失败' });
  }
});

// 错误处理中间件
app.use(errorHandler);

module.exports = app;
