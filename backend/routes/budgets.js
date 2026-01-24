'use strict';

const express = require('express');

module.exports = function budgetsRouter(db) {
  const router = express.Router();

  // Helper function to record budget history
  const recordBudgetHistory = async (userId, budgetId, action, oldValue, newValue, reason = null) => {
    try {
      // Normalize action values to match frontend expectations
      const normalizeActionForInsert = (a) => {
        const s = String(a || '').toLowerCase();
        if (s === 'create') return 'created';
        if (s === 'update') return 'updated';
        if (s === 'delete') return 'deleted';
        if (s === 'adjust') return 'adjusted';
        if (['created', 'updated', 'deleted', 'adjusted'].includes(s)) return s;
        return 'updated';
      };
      const actionValue = normalizeActionForInsert(action);
      await db.run(`
        INSERT INTO budget_history (budget_id, user_id, action, old_value, new_value, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [budgetId, userId, actionValue, oldValue, newValue, reason]);
    } catch (error) {
      console.error('❌ Failed to record budget history:', error);
    }
  };
  
  // Helper to format budget data for the frontend
  const formatBudget = (budget) => ({
    id: budget.id,
    budgetType: budget.budget_type,
    category: budget.category,
    categoryId: budget.category_id,
    monthlyLimit: budget.monthly_limit || 0,
    quarterlyLimit: budget.quarterly_limit || 0,
    yearlyLimit: budget.yearly_limit || 0,
    period: budget.period || 'monthly',
    startDate: budget.start_date,
    endDate: budget.end_date,
    alertThreshold: budget.alert_threshold || 80,
    isActive: budget.is_active !== 0,
    description: budget.description,
    createdAt: budget.created_at,
    updatedAt: budget.updated_at,
    parentId: budget.parent_id
  });

  // GET /budgets - Fetch budgets in a hierarchical structure
  router.get('/budgets', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const allBudgets = await db.all(
        'SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL ORDER BY budget_type DESC, category',
        [userId]
      );

      const totalBudget = allBudgets.find(b => b.budget_type === 'total');
      const categoryBudgets = allBudgets.filter(b => b.budget_type === 'category');

      if (totalBudget) {
        const formattedTotalBudget = formatBudget(totalBudget);
        formattedTotalBudget.children = categoryBudgets.map(formatBudget);
        return res.json([formattedTotalBudget]); // Return as an array
      }

      // If no total budget, just return category budgets or empty array
      res.json(categoryBudgets.map(formatBudget));

    } catch (err) {
      next(err);
    }
  });

  // POST /budgets - Create a new budget (total or category)
  router.post('/budgets', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { budgetType, categoryId } = req.body;
      const period = req.body.period || 'monthly';
      const budgetAmount = Number(req.body.budgetAmount) || 0;
      const frontendMonthlyLimit = Number(req.body.monthlyLimit) || 0;
      const frontendQuarterlyLimit = Number(req.body.quarterlyLimit) || 0;
      const frontendYearlyLimit = Number(req.body.yearlyLimit) || 0;

      // Derive monthly limit from either budgetAmount+period or raw limits
      let monthlyLimit = 0;
      if (budgetAmount > 0) {
        if (period === 'monthly') monthlyLimit = budgetAmount;
        else if (period === 'quarterly') monthlyLimit = budgetAmount / 3;
        else if (period === 'yearly') monthlyLimit = budgetAmount / 12;
      } else if (frontendMonthlyLimit > 0) {
        monthlyLimit = frontendMonthlyLimit;
      } else if (frontendQuarterlyLimit > 0) {
        monthlyLimit = frontendQuarterlyLimit / 3;
      } else if (frontendYearlyLimit > 0) {
        monthlyLimit = frontendYearlyLimit / 12;
      }

      if (!monthlyLimit || monthlyLimit <= 0) {
        return res.status(400).json({ error: 'Budget amount must be greater than 0.' });
      }

      const quarterlyLimit = monthlyLimit * 3;
      const yearlyLimit = monthlyLimit * 12;
      const description = req.body.description || '';
      // Optional custom date range support
      const rawStartDate = req.body.startDate;
      const rawEndDate = req.body.endDate;
      const parsedStart = rawStartDate ? new Date(rawStartDate) : null;
      const parsedEnd = rawEndDate ? new Date(rawEndDate) : null;
      const useCustomDates = parsedStart && !isNaN(parsedStart.getTime()) && parsedEnd && !isNaN(parsedEnd.getTime());

      if (budgetType === 'total') {
        const existingTotal = await db.get(
          'SELECT id FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ?',
          [userId, 'total']
        );
        if (existingTotal) {
          return res.status(409).json({ error: 'A total budget already exists.' });
        }

        // Insert total budget
        const result = await db.run(`
          INSERT INTO budgets (user_id, budget_type, monthly_limit, quarterly_limit, yearly_limit, period, start_date, end_date, alert_threshold, is_active, description, created_at, updated_at)
          VALUES (?, 'total', ?, ?, ?, ?, ?, ?, 80, 1, ?, datetime('now'), datetime('now'))`,
          [
            userId,
            monthlyLimit,
            quarterlyLimit,
            yearlyLimit,
            period,
            useCustomDates ? parsedStart.toISOString().slice(0, 10) : null,
            useCustomDates ? parsedEnd.toISOString().slice(0, 10) : null,
            description
          ]
        );

        // Record history
        await recordBudgetHistory(userId, result.lastID, 'created', null, monthlyLimit, 'Total budget created');

        const newBudget = await db.get(
          'SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [result.lastID, userId]
        );
        return res.status(201).json(formatBudget(newBudget));
      } else if (budgetType === 'category') {
        const totalBudget = await db.get(
          'SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ?',
          [userId, 'total']
        );
        if (!totalBudget) {
          return res.status(400).json({ error: 'Please set a total budget first.' });
        }

        const allocatedResult = await db.get(
          'SELECT SUM(monthly_limit) as allocated FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ?',
          [userId, 'category']
        );
        const allocatedSum = allocatedResult.allocated || 0;

        if (allocatedSum + monthlyLimit > totalBudget.monthly_limit) {
          return res.status(400).json({ 
            error: `Cannot add category budget. Allocated sum (${allocatedSum + monthlyLimit}) would exceed total budget (${totalBudget.monthly_limit}).` 
          });
        }
        
        // Insert category budget
        const category = await db.get(
          'SELECT name FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [categoryId, userId]
        );
        if (!category) {
          return res.status(404).json({ error: 'Category not found.' });
        }
        const result = await db.run(`
          INSERT INTO budgets (user_id, budget_type, category_id, category, parent_id, monthly_limit, quarterly_limit, yearly_limit, period, start_date, end_date, alert_threshold, is_active, description, created_at, updated_at)
          VALUES (?, 'category', ?, ?, ?, ?, ?, ?, ?, ?, ?, 80, 1, ?, datetime('now'), datetime('now'))`,
          [
            userId,
            categoryId,
            category.name,
            totalBudget.id,
            monthlyLimit,
            quarterlyLimit,
            yearlyLimit,
            period,
            useCustomDates ? parsedStart.toISOString().slice(0, 10) : null,
            useCustomDates ? parsedEnd.toISOString().slice(0, 10) : null,
            description
          ]
        );

        // Record history
        await recordBudgetHistory(userId, result.lastID, 'created', null, monthlyLimit, `Category budget created for ${category.name}`);

        const newBudget = await db.get(
          'SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [result.lastID, userId]
        );
        return res.status(201).json(formatBudget(newBudget));
      } else {
        return res.status(400).json({ error: 'Invalid budget type. Must be "total" or "category".' });
      }

    } catch (err) {
      next(err);
    }
  });

  // PUT /budgets/:id - Update a budget
  router.put('/budgets/:id', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const period = req.body.period || 'monthly';
      const description = req.body.description || '';

      // Accept either budgetAmount or raw limits from frontend
      const budgetAmount = Number(req.body.budgetAmount) || 0;
      const frontendMonthlyLimit = Number(req.body.monthlyLimit) || 0;
      const frontendQuarterlyLimit = Number(req.body.quarterlyLimit) || 0;
      const frontendYearlyLimit = Number(req.body.yearlyLimit) || 0;

      // Derive monthly limit
      let monthlyLimit = 0;
      if (budgetAmount > 0) {
        if (period === 'monthly') monthlyLimit = budgetAmount;
        else if (period === 'quarterly') monthlyLimit = budgetAmount / 3;
        else if (period === 'yearly') monthlyLimit = budgetAmount / 12;
      } else if (frontendMonthlyLimit > 0) {
        monthlyLimit = frontendMonthlyLimit;
      } else if (frontendQuarterlyLimit > 0) {
        monthlyLimit = frontendQuarterlyLimit / 3;
      } else if (frontendYearlyLimit > 0) {
        monthlyLimit = frontendYearlyLimit / 12;
      }

      if (!monthlyLimit || monthlyLimit <= 0) {
        return res.status(400).json({ error: 'Budget amount must be greater than 0.' });
      }

      // Get current budget
      const currentBudget = await db.get(
        'SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [id, userId]
      );
      if (!currentBudget) {
        return res.status(404).json({ error: 'Budget not found.' });
      }

      // Calculate limits based on period
      const quarterlyLimit = monthlyLimit * 3;
      const yearlyLimit = monthlyLimit * 12;

      if (currentBudget.budget_type === 'total') {
        // Update total budget
        const allocatedResult = await db.get(
          'SELECT SUM(monthly_limit) as allocated FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ? AND parent_id = ?',
          [userId, 'category', currentBudget.id]
        );
        const allocatedSum = allocatedResult.allocated || 0;

        if (monthlyLimit < allocatedSum) {
          return res.status(400).json({
            error: `Cannot reduce total budget below allocated amount (${allocatedSum}).`
          });
        }

        // Update total budget
        await db.run(`
          UPDATE budgets
          SET monthly_limit = ?, quarterly_limit = ?, yearly_limit = ?, period = ?, description = ?, updated_at = datetime('now')
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
          [monthlyLimit, quarterlyLimit, yearlyLimit, period, description || '', id, userId]
        );

        // Record history
        await recordBudgetHistory(userId, id, 'updated', currentBudget.monthly_limit, monthlyLimit, 'Total budget updated');

      } else if (currentBudget.budget_type === 'category') {
        // Update category budget
        const totalBudget = await db.get(
          'SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ?',
          [userId, 'total']
        );
        if (!totalBudget) {
          return res.status(400).json({ error: 'Total budget not found.' });
        }

        const otherAllocatedResult = await db.get(
          'SELECT SUM(monthly_limit) as allocated FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ? AND parent_id = ? AND id != ?',
          [userId, 'category', totalBudget.id, id]
        );
        const otherAllocatedSum = otherAllocatedResult.allocated || 0;

        if (otherAllocatedSum + monthlyLimit > totalBudget.monthly_limit) {
          return res.status(400).json({
            error: `Cannot update category budget. New limit would exceed total budget (${totalBudget.monthly_limit}).`
          });
        }

        // Update category budget
        await db.run(`
          UPDATE budgets
          SET monthly_limit = ?, quarterly_limit = ?, yearly_limit = ?, period = ?, description = ?, updated_at = datetime('now')
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
          [monthlyLimit, quarterlyLimit, yearlyLimit, period, description || '', id, userId]
        );

        // Record history
        await recordBudgetHistory(userId, id, 'updated', currentBudget.monthly_limit, monthlyLimit, 'Category budget updated');

      } else {
        return res.status(400).json({ error: 'Invalid budget type.' });
      }

      const updatedBudget = await db.get(
        'SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [id, userId]
      );
      return res.json(formatBudget(updatedBudget));

    } catch (err) {
      next(err);
    }
  });
  
  // DELETE /budgets/:id - Delete a budget
  router.delete('/budgets/:id', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Get current budget
      const currentBudget = await db.get(
        'SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [id, userId]
      );
      if (!currentBudget) {
        return res.status(404).json({ error: 'Budget not found.' });
      }

      if (currentBudget.budget_type === 'total') {
        // Check for child budgets
        const childCount = await db.get(
          'SELECT COUNT(*) as count FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND parent_id = ?',
          [userId, id]
        );
        if (childCount.count > 0) {
          return res.status(400).json({
            error: `Cannot delete total budget with ${childCount.count} category budgets. Delete category budgets first or delete all at once.`
          });
        }
      }

      // Record history before deletion
      await recordBudgetHistory(userId, id, 'deleted', currentBudget.monthly_limit, null,
        `${currentBudget.budget_type === 'total' ? 'Total' : 'Category'} budget deleted`);

      // Soft delete to support sync
      await db.run(
        'UPDATE budgets SET deleted_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [id, userId]
      );

      res.status(204).send();

    } catch (err) {
      next(err);
    }
  });

  // GET /budget-status - Reworked for parent-child model
  router.get('/budget-status', async (req, res, next) => {
    try {
      const userId = req.user.id;
      // Get total budget and category budgets
      const totalBudget = await db.get(
        'SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ?',
        [userId, 'total']
      );
      if (!totalBudget) {
        return res.json({ message: 'No total budget set.' });
      }

      // Include all category budgets (even if legacy records lack parent_id)
      const categoryBudgets = await db.all(
        'SELECT * FROM budgets WHERE user_id = ? AND deleted_at IS NULL AND budget_type = ?',
        [userId, 'category']
      );

      // Helper to get period range
      const pad2 = (n) => String(n).padStart(2, '0');
      const toDateStr = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

      const getPeriodRange = (budget) => {
        // If custom dates are set, use them
        if (budget && budget.start_date && budget.end_date) {
          const startStr = budget.start_date;
          const endStr = budget.end_date;
          return { startStr, endStr };
        }

        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth(); // 0-11
        const period = budget?.period || 'monthly';

        if (period === 'yearly') {
          const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
          const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
          return { startStr: toDateStr(start), endStr: toDateStr(end) };
        }
        if (period === 'quarterly') {
          const quarterStartMonth = Math.floor(month / 3) * 3; // 0,3,6,9
          const start = new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0));
          const endMonth = quarterStartMonth + 3; // exclusive
          const end = new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999)); // day 0 of next month => last day prev month
          return { startStr: toDateStr(start), endStr: toDateStr(end) };
        }
        // default monthly
        const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
        return { startStr: toDateStr(start), endStr: toDateStr(end) };
      };

      const totalRange = getPeriodRange(totalBudget);

      // Calculate total spent (all expense transactions) within total budget period
      const totalSpentResult = await db.get(
        'SELECT SUM(amount) as total FROM transactions t WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.type = ? AND DATE(t.date) >= ? AND DATE(t.date) <= ?',
        [userId, 'expense', totalRange.startStr, totalRange.endStr]
      );
      const totalSpent = totalSpentResult.total || 0;

      // Calculate spent for each category
      const categoryStatuses = [];
      for (const categoryBudget of categoryBudgets) {
        const { startStr, endStr } = getPeriodRange(categoryBudget);
        const categorySpentResult = await db.get(
          `SELECT SUM(t.amount) as spent
             FROM transactions t
             LEFT JOIN categories c
               ON LOWER(TRIM(t.category)) = LOWER(TRIM(c.name))
              AND c.user_id = ?
              AND c.deleted_at IS NULL
            WHERE t.user_id = ?
              AND t.deleted_at IS NULL
              AND t.type = ?
              AND (c.id = ? OR LOWER(TRIM(t.category)) = LOWER(TRIM(?)))
              AND DATE(t.date) >= ? AND DATE(t.date) <= ?`,
          [userId, userId, 'expense', categoryBudget.category_id || -1, categoryBudget.category || '', startStr, endStr]
        );
        const categorySpent = categorySpentResult.spent || 0;

        categoryStatuses.push({
          id: categoryBudget.id,
          category: categoryBudget.category,
          categoryId: categoryBudget.category_id,
          limit: categoryBudget.monthly_limit,
          spent: categorySpent,
          remaining: categoryBudget.monthly_limit - categorySpent,
          parentId: categoryBudget.parent_id
        });
      }

      // Return structured response
      const response = {
        totalBudget: {
          id: totalBudget.id,
          limit: totalBudget.monthly_limit,
          spent: totalSpent,
          remaining: totalBudget.monthly_limit - totalSpent,
          allocated: categoryBudgets.reduce((sum, cb) => sum + cb.monthly_limit, 0),
          unallocated: totalBudget.monthly_limit - categoryBudgets.reduce((sum, cb) => sum + cb.monthly_limit, 0)
        },
        categoryBudgets: categoryStatuses
      };

      res.json(response);

    } catch (err) {
      next(err);
    }
  });

  // GET /budget-history - Fetch budget change history
  router.get('/budget-history', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
      const pageSize = Number(req.query.pageSize) > 0 ? Number(req.query.pageSize) : 50;
      const budgetId = req.query.budgetId ? Number(req.query.budgetId) : null;

      const whereClauses = ['user_id = ?', 'deleted_at IS NULL'];
      const params = [userId];
      if (budgetId) {
        whereClauses.push('budget_id = ?');
        params.push(budgetId);
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const offset = (page - 1) * pageSize;

      const rows = await db.all(
        `SELECT * FROM budget_history ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      const countRow = await db.get(
        `SELECT COUNT(*) as count FROM budget_history ${whereSql}`,
        params
      );

      const normalizeAction = (a) => {
        const s = String(a || '').toLowerCase();
        if (s === 'create') return 'created';
        if (s === 'update') return 'updated';
        if (s === 'delete') return 'deleted';
        if (s === 'adjust') return 'adjusted';
        if (['created', 'updated', 'deleted', 'adjusted'].includes(s)) return s;
        return 'updated';
      };

      const history = rows.map(r => ({
        id: r.id,
        budgetId: r.budget_id,
        action: normalizeAction(r.action),
        oldValue: r.old_value != null ? Number(r.old_value) : undefined,
        newValue: r.new_value != null ? Number(r.new_value) : 0,
        reason: r.reason || undefined,
        createdAt: r.created_at
      }));

      res.json({
        history,
        total: countRow?.count || 0,
        page,
        pageSize
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
