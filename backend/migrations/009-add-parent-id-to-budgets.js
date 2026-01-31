'use strict';

exports.up = function(db, next) {
  db.serialize(() => {
    const addColumnSQL = `
      ALTER TABLE budgets 
      ADD COLUMN parent_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE;
    `;

    db.run(addColumnSQL, function(err) {
      if (err) {
        console.error('Failed to add parent_id column:', err);
        return next(err);
      }
      console.log('✅ Column parent_id added successfully.');

      const createIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_budgets_parent_id ON budgets (parent_id);
      `;

      db.run(createIndexSQL, function(err) {
        if (err) {
          console.error('Failed to create index for parent_id:', err);
        } else {
          console.log('✅ Index for parent_id created successfully.');
        }
        
        next();
      });
    });
  });
};

exports.down = function(db, next) {
  // As noted before, dropping columns in SQLite is complex.
  // This down migration is intentionally left blank.
  console.warn('Skipping down migration for 009-add-parent-id-to-budgets.js.');
  next();
};
