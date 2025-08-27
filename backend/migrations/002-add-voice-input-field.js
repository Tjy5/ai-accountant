'use strict'

// 使用 sqlite3 直接操作数据库
const sqlite3 = require('sqlite3');

exports.up = function(db, callback) {
  db.run(`
    ALTER TABLE transactions 
    ADD COLUMN is_voice_input INTEGER DEFAULT 0
  `, function(err) {
    if (err && err.message.includes('duplicate column name')) {
      // 列已存在，跳过
      callback();
    } else if (err) {
      callback(err);
    } else {
      callback();
    }
  });
};

exports.down = function(db, callback) {
  // SQLite 不支持删除列，需要手动处理
  callback();
};
