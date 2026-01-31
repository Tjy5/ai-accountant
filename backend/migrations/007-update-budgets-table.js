'use strict'

exports.up = function (db, next) {
  db.serialize(() => {
    // 添加缺失的列到 budgets 表
    const addColumns = [
      'ALTER TABLE budgets ADD COLUMN budget_type TEXT DEFAULT "category"',
      'ALTER TABLE budgets ADD COLUMN category_id INTEGER',
      'ALTER TABLE budgets ADD COLUMN quarterly_limit REAL DEFAULT 0',
      'ALTER TABLE budgets ADD COLUMN yearly_limit REAL DEFAULT 0',
      'ALTER TABLE budgets ADD COLUMN period TEXT DEFAULT "monthly"',
      'ALTER TABLE budgets ADD COLUMN start_date DATE',
      'ALTER TABLE budgets ADD COLUMN end_date DATE',
      'ALTER TABLE budgets ADD COLUMN alert_threshold INTEGER DEFAULT 80',
      'ALTER TABLE budgets ADD COLUMN is_active BOOLEAN DEFAULT 1',
      'ALTER TABLE budgets ADD COLUMN description TEXT'
    ];
    
    let completed = 0;
    const total = addColumns.length;
    
    addColumns.forEach(sql => {
      db.run(sql, function(err) {
        if (err) {
          // 列可能已存在，忽略错误
          console.log(`列可能已存在，跳过: ${sql}`);
        }
        completed++;
        if (completed === total) {
          // 创建索引以提高查询性能
          db.run(`CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id)`, function(err) {
            if (err) {
              console.log('创建索引失败:', err);
            }
            next();
          });
        }
      });
    });
  });
};

exports.down = function (db, next) {
  // SQLite 不支持 DROP COLUMN，这里仅记录需要手工回滚
  console.log('注意：SQLite 不支持删除列，需要手动处理预算表列回滚');
  next();
};
