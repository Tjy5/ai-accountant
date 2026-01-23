'use strict';

const sqlite3 = require('sqlite3');

exports.up = function (next) {
  const db = new sqlite3.Database('./database.sqlite');

  db.serialize(() => {
    // 1. 创建 users 表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) {
        console.error('创建 users 表失败:', err);
        db.close();
        return next(err);
      }
      console.log('✅ users 表创建成功');
    });

    // 2. 创建 devices 表
    db.run(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_token TEXT NOT NULL,
        platform TEXT NOT NULL,
        last_sync_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('创建 devices 表失败:', err);
      } else {
        console.log('✅ devices 表创建成功');
      }
    });

    // 3. 为 transactions 表添加新字段
    const transactionColumns = [
      'ALTER TABLE transactions ADD COLUMN user_id INTEGER',
      'ALTER TABLE transactions ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))',
      'ALTER TABLE transactions ADD COLUMN deleted_at TEXT'
    ];

    transactionColumns.forEach(sql => {
      db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('修改 transactions 表失败:', err);
        }
      });
    });

    // 4. 为 categories 表添加新字段
    const categoryColumns = [
      'ALTER TABLE categories ADD COLUMN user_id INTEGER',
      'ALTER TABLE categories ADD COLUMN deleted_at TEXT'
    ];

    categoryColumns.forEach(sql => {
      db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('修改 categories 表失败:', err);
        }
      });
    });

    // 5. 为 budgets 表添加新字段
    const budgetColumns = [
      'ALTER TABLE budgets ADD COLUMN user_id INTEGER',
      'ALTER TABLE budgets ADD COLUMN deleted_at TEXT'
    ];

    budgetColumns.forEach(sql => {
      db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('修改 budgets 表失败:', err);
        }
      });
    });

    // 6. 创建索引以提高查询性能
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at)',
      'CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)'
    ];

    indexes.forEach(sql => {
      db.run(sql, (err) => {
        if (err) {
          console.error('创建索引失败:', err);
        }
      });
    });

    // 完成后关闭数据库
    setTimeout(() => {
      db.close();
      console.log('✅ 数据库迁移 010 完成');
      next();
    }, 1000);
  });
};

exports.down = function (next) {
  console.log('⚠️ SQLite 不支持删除列，需要手动回滚');
  next();
};
