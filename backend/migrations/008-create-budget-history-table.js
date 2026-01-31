'use strict'

exports.up = function (db, next) {
  db.serialize(() => {
    // 创建预算历史表
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS budget_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        old_value REAL,
        new_value REAL NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
      )
    `;

    db.run(createTableSQL, function(err) {
      if (err) {
        console.error('创建预算历史表失败:', err);
        next(err);
        return;
      }

      console.log('✅ 预算历史表创建成功');

      // 创建索引以提高查询性能
      db.run(`CREATE INDEX IF NOT EXISTS idx_budget_history_budget_id ON budget_history(budget_id)`, function(err) {
        if (err) {
          console.log('创建索引失败:', err);
        } else {
          console.log('✅ 预算历史表索引创建成功');
        }

        db.run(`CREATE INDEX IF NOT EXISTS idx_budget_history_created_at ON budget_history(created_at)`, function(err) {
          if (err) {
            console.log('创建时间索引失败:', err);
          } else {
            console.log('✅ 预算历史表时间索引创建成功');
          }

          next();
        });
      });
    });
  });
};

exports.down = function (db, next) {
  db.serialize(() => {
    // 删除预算历史表
    db.run('DROP TABLE IF EXISTS budget_history', function(err) {
      if (err) {
        console.error('删除预算历史表失败:', err);
        next(err);
        return;
      }

      console.log('✅ 预算历史表删除成功');
      next();
    });
  });
};
