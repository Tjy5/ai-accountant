'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const dbFile = path.resolve(__dirname, 'database.sqlite');
const stateFile = path.resolve(__dirname, '.migrate');

function loadState() {
  if (!fs.existsSync(stateFile)) {
    return { lastRun: null, migrations: [] };
  }
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      lastRun: parsed && parsed.lastRun ? parsed.lastRun : null,
      migrations: Array.isArray(parsed && parsed.migrations) ? parsed.migrations : []
    };
  } catch {
    return { lastRun: null, migrations: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function isBenignMigrationError(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  return msg.includes('duplicate column name') || msg.includes('already exists');
}

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
  const state = loadState();
  const applied = new Set((state.migrations || []).map((m) => m && m.title).filter(Boolean));
  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^(\d+)-.*\.js$/.test(f))
    .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]));

  for (const f of files) {
    const filePath = path.join(migrationsDir, f);
    if (applied.has(f)) {
      continue;
    }
    try {
      await runMigrationFile(db, filePath);
      state.migrations = Array.isArray(state.migrations) ? state.migrations : [];
      state.migrations.push({ title: f, timestamp: Date.now() });
      state.lastRun = f;
      applied.add(f);
      saveState(state);
      console.log(`✅ Migration applied: ${f}`);
    } catch (err) {
      if (isBenignMigrationError(err)) {
        state.migrations = Array.isArray(state.migrations) ? state.migrations : [];
        state.migrations.push({ title: f, timestamp: Date.now() });
        state.lastRun = f;
        applied.add(f);
        saveState(state);
        console.warn(`⏭️ Migration skipped (already applied): ${f}`);
        continue;
      }
      db.close();
      console.error(`❌ Migration failed on ${f}:`, err && err.message ? err.message : err);
      process.exit(1);
    }
  }

  db.close();
  console.log('✅ 数据库迁移完成！');
}

main().catch(err => {
  console.error('❌ 数据库迁移失败:', err);
  process.exit(1);
});


