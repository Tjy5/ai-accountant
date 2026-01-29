'use strict';

exports.up = function (db, next) {
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
      const msg = err && err.message ? String(err.message) : String(err);
      if (msg.includes('already exists')) return;
      if (msg.includes('duplicate column name')) return;
      throw err;
    }
  };

  (async () => {
    try {
      // UI preferences (separate from keyword->category preferences)
      await safeRun(`
        CREATE TABLE IF NOT EXISTS user_ui_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          theme TEXT NOT NULL DEFAULT 'system',
          animations_enabled INTEGER NOT NULL DEFAULT 1,
          ai_assistant_visible INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await safeRun('CREATE INDEX IF NOT EXISTS idx_user_ui_preferences_user_id ON user_ui_preferences(user_id)');

      // Notifications
      await safeRun(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('success', 'warning', 'error')),
          title TEXT,
          message TEXT NOT NULL,
          data_json TEXT,
          read_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await safeRun('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at)');

      // Transactions list optimization (pagination/infinite scroll)
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted_created_id ON transactions(user_id, deleted_at, created_at DESC, id DESC)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted_date ON transactions(user_id, deleted_at, date)');

      console.log('✅ Migration 013 applied: ui preferences, notifications, indexes');
      next();
    } catch (err) {
      console.error('❌ Migration 013 failed:', err);
      next(err);
    }
  })();
};

exports.down = function (next) {
  console.warn('⚠️ Skip 013 down migration (SQLite limitations)');
  next();
};

