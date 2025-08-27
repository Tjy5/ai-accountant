'use strict'

const sqlite3 = require('sqlite3');

exports.up = function (next) {
  const db = new sqlite3.Database('../backend/database.sqlite');
  db.serialize(() => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount)`);
    db.close();
    next();
  });
};

exports.down = function (next) {
  const db = new sqlite3.Database('../backend/database.sqlite');
  db.serialize(() => {
    db.run(`DROP INDEX IF EXISTS idx_transactions_date`);
    db.run(`DROP INDEX IF EXISTS idx_transactions_type`);
    db.run(`DROP INDEX IF EXISTS idx_transactions_category`);
    db.run(`DROP INDEX IF EXISTS idx_transactions_amount`);
    db.close();
    next();
  });
};


