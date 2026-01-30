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
      // Transactions list optimization
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted_created_id ON transactions(user_id, deleted_at, created_at DESC, id DESC)');
      await safeRun('CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted_date ON transactions(user_id, deleted_at, date)');

      console.log('✅ Migration 013 applied: transaction indexes');
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
