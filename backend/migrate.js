'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const dbFile = path.resolve(__dirname, 'database.sqlite');

function runMigrationFile(db, filePath) {
  return new Promise((resolve, reject) => {
    const migration = require(filePath);

    // Support both (next) and (db, callback) signatures used in repo
    if (typeof migration.up === 'function' && migration.up.length === 1) {
      // style: exports.up = function(next) { ... }
      migration.up((err) => {
        if (err) return reject(err);
        resolve();
      });
    } else if (typeof migration.up === 'function' && migration.up.length >= 2) {
      // style: exports.up = function(db, callback) { ... }
      migration.up(db, (err) => {
        if (err) return reject(err);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function main() {
  const db = new sqlite3.Database(dbFile);
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^(\d+)-.*\.js$/.test(f))
    .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]));

  for (const f of files) {
    const filePath = path.join(migrationsDir, f);
    try {
      await runMigrationFile(db, filePath);
      console.log(`✅ Migration applied: ${f}`);
    } catch (err) {
      // Many migrations are idempotent and may throw if columns exist; log and continue
      console.warn(`⚠️ Migration warning on ${f}:`, err && err.message ? err.message : err);
    }
  }

  db.close();
  console.log('✅ 数据库迁移完成！');
}

main().catch(err => {
  console.error('❌ 数据库迁移失败:', err);
  process.exit(1);
});


