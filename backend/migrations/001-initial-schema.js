'use strict'

// 使用 sqlite3 直接操作数据库
const sqlite3 = require('sqlite3');

exports.up = function (next) {
  const db = new sqlite3.Database('../backend/database.sqlite');
  
  // 创建交易表
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date DATETIME DEFAULT (datetime('now')),
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `, function(err) {
    if (err) {
      db.close();
      return next(err);
    }
    
    // 创建用户偏好表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT UNIQUE,
        category TEXT NOT NULL
      )
    `, function(err) {
      if (err) {
        db.close();
        return next(err);
      }
      
      // 创建预算表
      db.run(`
        CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          monthly_limit REAL NOT NULL,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now')),
          UNIQUE(category)
        )
      `, function(err) {
        if (err) {
          db.close();
          return next(err);
        }
        
        // 检查并添加 created_at 列（如果不存在）
        db.run(`ALTER TABLE transactions ADD COLUMN created_at DATETIME DEFAULT (datetime('now'))`, function(err) {
          // 忽略错误，列可能已存在
          
          // 为现有记录设置 created_at 值（如果为 NULL）
          db.run(`UPDATE transactions SET created_at = date WHERE created_at IS NULL`, function(err) {
            if (err) {
              db.close();
              return next(err);
            }
            
            db.close();
            next();
          });
        });
      });
    });
  });
};

exports.down = function (next) {
  const db = new sqlite3.Database('../backend/database.sqlite');
  
  // 回滚操作：删除所有表
  db.run('DROP TABLE IF EXISTS budgets', function(err) {
    if (err) {
      db.close();
      return next(err);
    }
    
    db.run('DROP TABLE IF EXISTS user_preferences', function(err) {
      if (err) {
        db.close();
        return next(err);
      }
      
      db.run('DROP TABLE IF EXISTS transactions', function(err) {
        if (err) {
          db.close();
          return next(err);
        }
        
        db.close();
        next();
      });
    });
  });
};
