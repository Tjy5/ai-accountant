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

  const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

  const hasCol = (cols, name) => Array.isArray(cols) && cols.some((c) => c && c.name === name);

  (async () => {
    let fkOff = false;
    let inTx = false;
    try {
      await run('PRAGMA foreign_keys = OFF');
      fkOff = true;

      await run('BEGIN');
      inTx = true;

      // 第一部分: 重建 categories 表
      console.log('开始重建 categories 表...');

      const categoriesRow = await get(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'`
      );

      const categoriesSql = categoriesRow?.sql || '';
      const categoriesNeedsRebuild =
        /\bname\s+TEXT\s+NOT\s+NULL\s+UNIQUE\b/i.test(categoriesSql) ||
        /\bUNIQUE\s*\(\s*name\s*\)/i.test(categoriesSql);

      const categoriesUserNameIdx = await get(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_categories_user_name' AND tbl_name='categories'`
      );

      // 检查是否需要重建 (如果存在全局 UNIQUE(name) 约束，且未建立 UNIQUE(user_id,name))
      if (!categoriesUserNameIdx && categoriesNeedsRebuild) {
        await run('DROP TABLE IF EXISTS categories_new');
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
          INSERT INTO categories_new (id, name, type, icon, color, description, is_default, usage_count, created_at, updated_at, user_id, deleted_at)
          SELECT id, name, type, icon, color, description, is_default, usage_count, created_at, updated_at, user_id, deleted_at
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
      const budgetsHasUniqueCategory =
        /\bcategory\s+TEXT\s+NOT\s+NULL\s+UNIQUE\b/i.test(budgetsSql) ||
        /\bUNIQUE\s*\(\s*category\s*\)/i.test(budgetsSql);
      const budgetsCategoryNotNull = /\bcategory\s+TEXT\s+NOT\s+NULL\b/i.test(budgetsSql);
      const budgetsNeedsRebuild = budgetsHasUniqueCategory || budgetsCategoryNotNull;

      // 检查是否需要重建 (移除 UNIQUE(category)，并允许 category 为空以支持 total budget)
      if (budgetsNeedsRebuild) {
        await run('DROP TABLE IF EXISTS budgets_new');
        await run(`
          CREATE TABLE budgets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
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
          INSERT INTO budgets_new (id, category, monthly_limit, created_at, updated_at, budget_type, category_id, quarterly_limit, yearly_limit, period, start_date, end_date, alert_threshold, is_active, description, parent_id, user_id, deleted_at)
          SELECT id, category, monthly_limit, created_at, updated_at, budget_type, category_id, quarterly_limit, yearly_limit, period, start_date, end_date, alert_threshold, is_active, description, parent_id, user_id, deleted_at
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

      // 第三部分: 重建 user_preferences 表
      console.log('开始重建 user_preferences 表...');

      const userPreferencesRow = await get(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='user_preferences'`
      );

      if (!userPreferencesRow) {
        console.log('⏭️ user_preferences 表不存在，跳过');
      } else {
        const userPreferencesSql = userPreferencesRow?.sql || '';
        const prefsHasGlobalUniqueKeyword =
          /\bkeyword\s+TEXT\s+UNIQUE\b/i.test(userPreferencesSql) ||
          /\bUNIQUE\s*\(\s*keyword\s*\)/i.test(userPreferencesSql);

        const prefsUserKeywordIdx = await get(
          `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_user_preferences_user_keyword' AND tbl_name='user_preferences'`
        );

        // 仅当仍存在全局 UNIQUE(keyword) 且未建立 UNIQUE(user_id,keyword) 时重建
        if (!prefsUserKeywordIdx && prefsHasGlobalUniqueKeyword) {
          const cols = await all(`PRAGMA table_info(user_preferences)`);
          const selectUserId = hasCol(cols, 'user_id') ? 'user_id' : 'NULL';
          const selectCreatedAt = hasCol(cols, 'created_at') ? "COALESCE(created_at, datetime('now'))" : "datetime('now')";
          const selectUpdatedAt = hasCol(cols, 'updated_at') ? "COALESCE(updated_at, datetime('now'))" : "datetime('now')";
          const selectDeletedAt = hasCol(cols, 'deleted_at') ? 'deleted_at' : 'NULL';

          await run('DROP TABLE IF EXISTS user_preferences_new');
          await run(`
            CREATE TABLE user_preferences_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              keyword TEXT NOT NULL,
              category TEXT NOT NULL,
              user_id INTEGER,
              created_at TEXT DEFAULT (datetime('now')),
              updated_at TEXT DEFAULT (datetime('now')),
              deleted_at TEXT
            )
          `);

          await run(`
            INSERT INTO user_preferences_new (id, keyword, category, user_id, created_at, updated_at, deleted_at)
            SELECT
              id,
              keyword,
              category,
              ${selectUserId} AS user_id,
              ${selectCreatedAt} AS created_at,
              ${selectUpdatedAt} AS updated_at,
              ${selectDeletedAt} AS deleted_at
            FROM user_preferences
          `);

          await run('DROP TABLE user_preferences');
          await run('ALTER TABLE user_preferences_new RENAME TO user_preferences');

          await run('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)');
          await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_keyword ON user_preferences(user_id, keyword)');

          console.log('✅ user_preferences 表重建完成');
        } else {
          console.log('⏭️ user_preferences 表无需重建');
        }
      }

      await run('COMMIT');
      inTx = false;

      await run('PRAGMA foreign_keys = ON');
      fkOff = false;
      console.log('✅ 数据库迁移 011 完成');
      next();
    } catch (err) {
      try {
        if (inTx) await run('ROLLBACK');
      } catch {}

      try {
        if (fkOff) await run('PRAGMA foreign_keys = ON');
      } catch {}

      console.error('❌ 迁移失败:', err);
      next(err);
    }
  })();
};

exports.down = function (next) {
  console.warn('⚠️ 跳过 011 迁移的回滚');
  next();
};
