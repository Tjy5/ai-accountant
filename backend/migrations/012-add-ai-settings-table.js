'use strict';

// 创建用户 AI 配置表，支持 OpenAI 兼容的 API 配置
// API Key 使用 AES-GCM 加密存储

exports.up = function (db, next) {
  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });

  (async () => {
    try {
      await run(`
        CREATE TABLE IF NOT EXISTS user_ai_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          api_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
          api_key_encrypted TEXT NOT NULL,
          model TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
          temperature REAL DEFAULT 0.7,
          max_tokens INTEGER DEFAULT 1000,
          enabled INTEGER DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);

      await run('CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user_id ON user_ai_settings(user_id)');
      await run('CREATE INDEX IF NOT EXISTS idx_user_ai_settings_enabled ON user_ai_settings(enabled) WHERE deleted_at IS NULL');

      console.log('✅ 数据库迁移 012 完成: user_ai_settings 表已创建');
      next();
    } catch (err) {
      console.error('❌ 迁移失败:', err);
      next(err);
    }
  })();
};

exports.down = function (db, next) {
  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
      });
    });

  (async () => {
    try {
      await run('DROP INDEX IF EXISTS idx_user_ai_settings_enabled');
      await run('DROP INDEX IF EXISTS idx_user_ai_settings_user_id');
      await run('DROP TABLE IF EXISTS user_ai_settings');
      console.log('✅ 迁移 012 回滚完成');
      next();
    } catch (err) {
      console.error('❌ 回滚失败:', err);
      next(err);
    }
  })();
};
