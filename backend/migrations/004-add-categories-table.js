'use strict'

// 使用 sqlite3 直接操作数据库
const sqlite3 = require('sqlite3');

exports.up = function (next) {
  const db = new sqlite3.Database('../backend/database.sqlite');

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'both')),
        icon TEXT,
        color TEXT,
        description TEXT,
        is_default INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `, function(err) {
      if (err) {
        db.close();
        return next(err);
      }

      // 预置一些常用默认分类（如表为空）
      db.all('SELECT COUNT(*) as cnt FROM categories', (err, rows) => {
        if (err) {
          db.close();
          return next(err);
        }

        const count = rows && rows[0] ? rows[0].cnt : 0;
        if (count === 0) {
          const stmt = db.prepare(`
            INSERT INTO categories (name, type, icon, color, description, is_default, usage_count)
            VALUES (?, ?, ?, ?, ?, 1, 0)
          `);
          const defaults = [
            ['餐饮', 'expense', 'ShoppingOutlined', '#ff4d4f', '日常餐饮消费'],
            ['交通', 'expense', 'CarOutlined', '#1890ff', '公共交通、打车等'],
            ['购物', 'expense', 'ShoppingOutlined', '#52c41a', '日常用品购买'],
            ['工资', 'income', 'DollarOutlined', '#52c41a', '工资收入'],
            ['奖金', 'income', 'TrophyOutlined', '#faad14', '奖金、红包等']
          ];
          for (const d of defaults) {
            stmt.run(d);
          }
          stmt.finalize((finalizeErr) => {
            db.close();
            next(finalizeErr);
          });
        } else {
          db.close();
          next();
        }
      });
    });
  });
};

exports.down = function (next) {
  const db = new sqlite3.Database('../backend/database.sqlite');
  db.run('DROP TABLE IF EXISTS categories', function(err) {
    db.close();
    next(err);
  });
};


