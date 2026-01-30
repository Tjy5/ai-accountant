'use strict';

const path = require('path');
const sqlite3 = require('sqlite3');

exports.up = function (next) {
  const dbPath = path.resolve(__dirname, '../database.sqlite');
  const db = new sqlite3.Database(dbPath);

  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });

  const safeRun = async (sql, params = []) => {
    try {
      await run(sql, params);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('duplicate column name')) return;
      if (msg.includes('already exists')) return;
      throw err;
    }
  };

  (async () => {
    try {
      await safeRun('PRAGMA foreign_keys = OFF');

      // 1) 创建 users 表
      await safeRun(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      console.log('✅ users 表创建成功');

      // 2) 为 transactions 表添加新字段
      await safeRun('ALTER TABLE transactions ADD COLUMN user_id INTEGER');
      await safeRun('ALTER TABLE transactions ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))');
      await safeRun('ALTER TABLE transactions ADD COLUMN deleted_at TEXT');
      console.log('✅ transactions 表字段添加成功');

      // 3) 为 categories 表添加新字段
      await safeRun('ALTER TABLE categories ADD COLUMN user_id INTEGER');
      await safeRun('ALTER TABLE categories ADD COLUMN deleted_at TEXT');
      console.log('✅ categories 表字段添加成功');

      // 4) 为 budgets 表添加新字段
      await safeRun('ALTER TABLE budgets ADD COLUMN user_id INTEGER');
      await safeRun('ALTER TABLE budgets ADD COLUMN deleted_at TEXT');
      console.log('✅ budgets 表字段添加成功');

      // 5) 为 user_preferences 表添加新字段
      await safeRun('ALTER TABLE user_preferences ADD COLUMN user_id INTEGER');
      await safeRun('ALTER TABLE user_preferences ADD COLUMN created_at TEXT DEFAULT (datetime(\'now\'))');
      await safeRun('ALTER TABLE user_preferences ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))');
      await safeRun('ALTER TABLE user_preferences ADD COLUMN deleted_at TEXT');

      // 6) 为 budget_history 表添加新字段
      await safeRun('ALTER TABLE budget_history ADD COLUMN user_id INTEGER');
      await safeRun('ALTER TABLE budget_history ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))');
      await safeRun('ALTER TABLE budget_history ADD COLUMN deleted_at TEXT');

      // 7) 回填 updated_at 字段 (如果为 NULL)
      await safeRun(`UPDATE transactions SET updated_at = COALESCE(updated_at, created_at, datetime('now')) WHERE updated_at IS NULL`);
      await safeRun(`UPDATE budget_history SET updated_at = COALESCE(updated_at, created_at, datetime('now')) WHERE updated_at IS NULL`);
      await safeRun(`UPDATE user_preferences SET updated_at = COALESCE(updated_at, created_at, datetime('now')) WHERE updated_at IS NULL`);
      await safeRun(`UPDATE user_preferences SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL`);

      // 8) 创建索引以提高查询性能
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_budget_history_user_id ON budget_history(user_id)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)');
      console.log('✅ 索引创建成功');

      await safeRun('PRAGMA foreign_keys = ON');
      db.close();
      console.log('✅ 数据库迁移 010 完成');
      next();
    } catch (err) {
      console.error('❌ 迁移失败:', err);
      db.close();
      next(err);
    }
  })();
};

exports.down = function (next) {
  console.log('⚠️ SQLite 不支持删除列，需要手动回滚');
  next();
};
