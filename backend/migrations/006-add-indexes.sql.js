'use strict'

exports.up = function (db, next) {
  db.serialize(() => {
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount)`);
    next();
  });
};

exports.down = function (db, next) {
  db.serialize(() => {
    db.run(`DROP INDEX IF EXISTS idx_transactions_date`);
    db.run(`DROP INDEX IF EXISTS idx_transactions_type`);
    db.run(`DROP INDEX IF EXISTS idx_transactions_category`);
    db.run(`DROP INDEX IF EXISTS idx_transactions_amount`);
    next();
  });
};


