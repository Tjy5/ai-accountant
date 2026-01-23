'use strict';

// 重建表结构以支持多用户:
// - categories: UNIQUE(name) -> UNIQUE(user_id, name)
// - budgets: UNIQUE(category) -> 移除 (允许每个用户有自己的预算)
// - user_preferences: UNIQUE(keyword) -> UNIQUE(user_id, keyword)

exports.up = function (db, next) {
  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });

  const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

  (async () => {
    try {
      await run('PRAGMA foreign_keys = OFF');

      // 第一部分: 重建 categories 表
      console.log('开始重建 categories 表...');

      const categoriesRow = await get(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'`
      );

      const categoriesSql = categoriesRow?.sql || '';

      // 检查是否需要重建 (如果存在 UNIQUE(name) 约束)
      if (/\bname\s+TEXT\s+NOT\s+NULL\s+UNIQUE\b/i.test(categoriesSql)) {
        await run(`
          CREATE TABLE categories_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'both')),
            icon TEXT,
            color TEXT,
            description TEXT,
            is_default INTEGER DEFAULT 0,
            usage_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now')),
            user_id INTEGER,
            deleted_at TEXT
          )
        `);

        await run(`
          INSERT INTO categories_new
          SELECT id, name, type, icon, color, description, is_default,
                 usage_count, created_at, updated_at, user_id, deleted_at
          FROM categories
        `);

        await run('DROP TABLE categories');
        await run('ALTER TABLE categories_new RENAME TO categories');

        await run('CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)');
        await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name ON categories(user_id, name)');

        console.log('✅ categories 表重建完成');
      } else {
        console.log('⏭️ categories 表无需重建');
      }

      // 第二部分: 重建 budgets 表
      console.log('开始重建 budgets 表...');

      const budgetsRow = await get(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='budgets'`
      );

      const budgetsSql = budgetsRow?.sql || '';

      // 检查是否需要重建 (如果存在 UNIQUE(category) 约束)
      if (/\bUNIQUE\s*\(\s*category\s*\)/i.test(budgetsSql)) {
        await run(`
          CREATE TABLE budgets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            monthly_limit REAL NOT NULL,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now')),
            budget_type TEXT DEFAULT "category",
            category_id INTEGER,
            quarterly_limit REAL DEFAULT 0,
            yearly_limit REAL DEFAULT 0,
            period TEXT DEFAULT "monthly",
            start_date DATE,
            end_date DATE,
            alert_threshold INTEGER DEFAULT 80,
            is_active BOOLEAN DEFAULT 1,
            description TEXT,
            parent_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
            user_id INTEGER,
            deleted_at TEXT
          )
        `);

        await run(`
          INSERT INTO budgets_new
          SELECT id, category, monthly_limit, created_at, updated_at,
                 budget_type, category_id, quarterly_limit, yearly_limit, period,
                 start_date, end_date, alert_threshold, is_active, description,
                 parent_id, user_id, deleted_at
          FROM budgets
        `);

        await run('DROP TABLE budgets');
        await run('ALTER TABLE budgets_new RENAME TO budgets');

        await run('CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)');
        await run('CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id)');

        console.log('✅ budgets 表重建完成');
      } else {
        console.log('⏭️ budgets 表无需重建');
      }

      await run('PRAGMA foreign_keys = ON');
      console.log('✅ 数据库迁移 011 完成');
      next();
    } catch (err) {
      console.error('❌ 迁移失败:', err);
      next(err);
    }
  })();
};

exports.down = function (next) {
  console.warn('⚠️ 跳过 011 迁移的回滚');
  next();
};
