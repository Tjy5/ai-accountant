'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const authMiddleware = require('../middleware/auth');
const { signToken } = require('../utils/jwt');

const categoriesRouterFactory = require('../routes/categories');
const transactionsRouterFactory = require('../routes/transactions');
const dashboardRouterFactory = require('../routes/dashboard');
const preferencesRouterFactory = require('../routes/preferences');
const authRouterFactory = require('../routes/auth');

async function createTestDb() {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT,
      password_hash TEXT,
      name TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      user_id INTEGER,
      deleted_at TEXT
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      is_voice_input INTEGER DEFAULT 0,
      voice_input_text TEXT,
      tags TEXT
    );

    CREATE TABLE user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  await db.run(
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
     VALUES (1, 'test@example.com', 'x', 'Test', datetime('now'), datetime('now'))`
  );

  return db;
}

async function startServer(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', authMiddleware);
  app.use('/api', categoriesRouterFactory(db));
  app.use('/api', transactionsRouterFactory(db));
  app.use('/api', dashboardRouterFactory(db));
  app.use('/api', preferencesRouterFactory(db));
  return app;
}

function createAppWithAuth(db) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/auth', authRouterFactory(db));
  app.use('/api', authMiddleware);
  app.use('/api', categoriesRouterFactory(db));
  return app;
}

function authHeader() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_1234567890';
  const token = signToken({ id: 1, email: 'test@example.com', name: 'Test' }, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

test('GET /api/categories returns categories', async () => {
  const db = await createTestDb();
  await db.run(
    `INSERT INTO categories (user_id, name, type, icon, color, created_at, updated_at, deleted_at)
     VALUES (1, 'Home', 'expense', 'HomeOutlined', '#ff0000', datetime('now'), datetime('now'), NULL)`
  );

  const app = createApp(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const res = await fetch(`${baseUrl}/api/categories`, { headers: { ...authHeader() } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.categories));
    assert.equal(body.categories[0].name, 'Home');
    assert.equal(body.categories[0].icon, 'HomeOutlined');
    assert.equal(body.categories[0].color, '#ff0000');
    assert.ok(!('iconType' in body.categories[0]));
  } finally {
    server.close();
    await db.close();
  }
});

test('GET /api/transactions returns rows and supports paging', async () => {
  const db = await createTestDb();
  await db.run(
    `INSERT INTO categories (user_id, name, type, icon, color, created_at, updated_at, deleted_at)
     VALUES (1, 'Food', 'expense', 'CoffeeOutlined', '#00ff00', datetime('now'), datetime('now'), NULL)`
  );
  await db.run(
    `INSERT INTO transactions (user_id, type, category, amount, description, date, created_at, updated_at, deleted_at)
     VALUES (1, 'expense', 'Food', 10.0, 'Coffee', '2026-01-10T00:00:00.000Z', datetime('now'), datetime('now'), NULL)`
  );
  await db.run(
    `INSERT INTO transactions (user_id, type, category, amount, description, date, created_at, updated_at, deleted_at)
     VALUES (1, 'expense', 'Food', 20.5, 'Lunch', '2026-01-11T00:00:00.000Z', datetime('now'), datetime('now'), NULL)`
  );

  const app = createApp(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const res1 = await fetch(`${baseUrl}/api/transactions`, { headers: { ...authHeader() } });
    assert.equal(res1.status, 200);
    const list = await res1.json();
    assert.ok(Array.isArray(list));
    assert.ok(typeof list[0].amount === 'number');
    assert.ok(!('amountFormatted' in list[0]));
    assert.ok(!('timestamp' in list[0]));
    assert.ok(!('categoryMeta' in list[0]));

    const res2 = await fetch(`${baseUrl}/api/transactions?page=1&pageSize=1`, { headers: { ...authHeader() } });
    assert.equal(res2.status, 200);
    const page = await res2.json();
    assert.ok(Array.isArray(page.transactions));
    assert.equal(page.transactions.length, 1);
    assert.ok(page.pageInfo);
    assert.equal(page.pageInfo.limit, 1);
  } finally {
    server.close();
    await db.close();
  }
});

test('Dashboard summary/charts endpoints work', async () => {
  const db = await createTestDb();
  await db.run(
    `INSERT INTO categories (user_id, name, type, icon, color, created_at, updated_at, deleted_at)
     VALUES (1, 'Salary', 'income', 'DollarOutlined', '#111111', datetime('now'), datetime('now'), NULL)`
  );
  await db.run(
    `INSERT INTO categories (user_id, name, type, icon, color, created_at, updated_at, deleted_at)
     VALUES (1, 'Rent', 'expense', 'HomeOutlined', '#222222', datetime('now'), datetime('now'), NULL)`
  );
  await db.run(
    `INSERT INTO transactions (user_id, type, category, amount, description, date, created_at, updated_at, deleted_at)
     VALUES (1, 'income', 'Salary', 1000, 'Jan salary', '2026-01-05T00:00:00.000Z', datetime('now'), datetime('now'), NULL)`
  );
  await db.run(
    `INSERT INTO transactions (user_id, type, category, amount, description, date, created_at, updated_at, deleted_at)
     VALUES (1, 'expense', 'Rent', 400, 'Jan rent', '2026-01-06T00:00:00.000Z', datetime('now'), datetime('now'), NULL)`
  );

  const app = createApp(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const res1 = await fetch(`${baseUrl}/api/dashboard/summary?startDate=2026-01-01&endDate=2026-01-31`, { headers: { ...authHeader() } });
    assert.equal(res1.status, 200);
    const summary = await res1.json();
    assert.equal(summary.totals.income, 1000);
    assert.equal(summary.totals.expense, 400);
    assert.equal(summary.totals.net, 600);

    const res2 = await fetch(`${baseUrl}/api/dashboard/charts?startDate=2026-01-01&endDate=2026-01-31`, { headers: { ...authHeader() } });
    assert.equal(res2.status, 200);
    const charts = await res2.json();
    assert.ok(Array.isArray(charts.monthlyTrend));
    assert.ok(Array.isArray(charts.categoryShare));
    assert.equal(charts.categoryShare[0].category, 'Rent');
    assert.ok(!('categoryMeta' in charts.categoryShare[0]));
  } finally {
    server.close();
    await db.close();
  }
});

test('Preferences endpoints work', async () => {
  const db = await createTestDb();
  const app = createApp(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const res1 = await fetch(`${baseUrl}/api/preferences`, { headers: { ...authHeader() } });
    assert.equal(res1.status, 200);
    const before = await res1.json();
    assert.ok(Array.isArray(before.preferences));
    assert.equal(before.preferences.length, 0);

    const res2 = await fetch(`${baseUrl}/api/preferences`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'coffee', category: 'Food' }),
    });
    assert.equal(res2.status, 201);
    const created = await res2.json();
    assert.equal(created.preference.keyword, 'coffee');
    assert.equal(created.preference.category, 'Food');

    const res3 = await fetch(`${baseUrl}/api/preferences`, { headers: { ...authHeader() } });
    assert.equal(res3.status, 200);
    const after = await res3.json();
    assert.ok(Array.isArray(after.preferences));
    assert.equal(after.preferences.length, 1);
  } finally {
    server.close();
    await db.close();
  }
});

test('PUT /api/transactions validates amount and allows clearing tags', async () => {
  const db = await createTestDb();
  await db.run(
    `INSERT INTO categories (user_id, name, type, icon, color, created_at, updated_at, deleted_at)
     VALUES (1, 'Food', 'expense', 'CoffeeOutlined', '#00ff00', datetime('now'), datetime('now'), NULL)`
  );
  await db.run(
    `INSERT INTO transactions (user_id, type, category, amount, description, date, created_at, updated_at, deleted_at, tags)
     VALUES (1, 'expense', 'Food', 10.0, 'Coffee', '2026-01-10T00:00:00.000Z', datetime('now'), datetime('now'), NULL, '["a"]')`
  );

  const app = createApp(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const bad = await fetch(`${baseUrl}/api/transactions/1`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', category: 'Food', amount: 0 }),
    });
    assert.equal(bad.status, 400);

    const ok = await fetch(`${baseUrl}/api/transactions/1`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'expense', category: 'Food', amount: 10.0, tags: null }),
    });
    assert.equal(ok.status, 200);
    const updated = await ok.json();
    assert.equal(updated.tags, null);
  } finally {
    server.close();
    await db.close();
  }
});

test('POST /api/auth/register seeds default categories for new user', async () => {
  const db = await createTestDb();
  process.env.JWT_SECRET = 'test_secret_1234567890';

  const app = createAppWithAuth(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new.user@example.com', password: 'password123', name: 'New User' }),
    });
    assert.equal(reg.status, 201);
    const regBody = await reg.json();
    assert.ok(regBody && regBody.token);

    const res = await fetch(`${baseUrl}/api/categories`, { headers: { Authorization: `Bearer ${regBody.token}` } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.categories));
    assert.ok(body.categories.length > 0);
    assert.ok(body.categories.some((c) => c && c.name === '其他'));
  } finally {
    server.close();
    await db.close();
  }
});
