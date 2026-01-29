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
const notificationsRouterFactory = require('../routes/notifications');

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

    CREATE TABLE user_ui_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      theme TEXT NOT NULL DEFAULT 'system',
      animations_enabled INTEGER NOT NULL DEFAULT 1,
      ai_assistant_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      message TEXT NOT NULL,
      data_json TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  app.use('/api', notificationsRouterFactory(db));
  return app;
}

function authHeader() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_1234567890';
  const token = signToken({ id: 1, email: 'test@example.com', name: 'Test' }, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

test('GET /api/categories returns iconType', async () => {
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
    assert.equal(body.categories[0].iconType, 'home');
  } finally {
    server.close();
    await db.close();
  }
});

test('GET /api/transactions enriches rows and supports paging', async () => {
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
    assert.ok(typeof list[0].amountFormatted === 'string');
    assert.ok('timestamp' in list[0]);
    assert.ok(list[0].categoryMeta);
    assert.equal(list[0].categoryMeta.iconType, 'food');
    assert.equal(list[0].categoryMeta.color, '#00ff00');

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
    assert.equal(charts.categoryShare[0].categoryMeta.iconType, 'home');
  } finally {
    server.close();
    await db.close();
  }
});

test('UI preferences and notifications endpoints work', async () => {
  const db = await createTestDb();
  const app = createApp(db);
  const { server, baseUrl } = await startServer(app);
  try {
    const res1 = await fetch(`${baseUrl}/api/user/preferences`, { headers: { ...authHeader() } });
    assert.equal(res1.status, 200);
    const pref1 = await res1.json();
    assert.equal(pref1.preferences.theme, 'system');

    const res2 = await fetch(`${baseUrl}/api/user/preferences`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'dark', animationsEnabled: false, aiAssistantVisible: false }),
    });
    assert.equal(res2.status, 200);
    const pref2 = await res2.json();
    assert.equal(pref2.preferences.theme, 'dark');
    assert.equal(pref2.preferences.animationsEnabled, false);

    const res3 = await fetch(`${baseUrl}/api/notifications`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'success', title: 'OK', message: 'Done' }),
    });
    assert.equal(res3.status, 201);
    const created = await res3.json();
    assert.equal(created.type, 'success');
    assert.ok(created.style && created.style.color);

    const res4 = await fetch(`${baseUrl}/api/notifications?limit=10`, { headers: { ...authHeader() } });
    assert.equal(res4.status, 200);
    const list = await res4.json();
    assert.ok(Array.isArray(list.notifications));
    assert.equal(list.notifications.length, 1);

    const res5 = await fetch(`${baseUrl}/api/notifications/${created.id}/read`, {
      method: 'POST',
      headers: { ...authHeader() },
    });
    assert.equal(res5.status, 200);
    const read = await res5.json();
    assert.ok(read.readAt);
  } finally {
    server.close();
    await db.close();
  }
});

