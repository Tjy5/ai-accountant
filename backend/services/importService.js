'use strict'

const XLSX = require('xlsx');

// 解析一行交易记录
function parseTransactionRow(row, headers) {
  const getValue = (fieldName) => {
    const index = headers.indexOf(fieldName);
    return index >= 0 && index < row.length ? row[index] : null;
  };

  const type = getValue('类型');
  const amount = getValue('金额');
  const category = getValue('分类');
  const description = getValue('描述');
  const tagsCell = getValue('标签') ?? getValue('tags');
  const date = getValue('日期');

  if (!type || !amount || !category || !description || !date) {
    throw new Error('缺少必需字段');
  }

  if (!['收入', 'expense', '支出', 'income'].includes(type)) {
    throw new Error(`无效的交易类型: ${type}`);
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`无效的金额: ${amount}`);
  }

  let parsedDate;
  try {
    parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('无效日期');
    }
  } catch (e) {
    throw new Error(`无效的日期格式: ${date}`);
  }

  const normalizedType = ['收入', 'income'].includes(type) ? 'income' : 'expense';

  let parsedTags = null;
  if (tagsCell !== null && tagsCell !== undefined && String(tagsCell).trim()) {
    const raw = String(tagsCell).trim();
    try {
      if (raw.startsWith('[')) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          parsedTags = arr.map(v => String(v).trim()).filter(Boolean);
        }
      } else {
        parsedTags = raw
          .split(/[，,;；\s]+/)
          .map(s => s.trim())
          .filter(Boolean);
      }
    } catch (_) {
      parsedTags = raw
        .split(/[，,;；\s]+/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  }

  return {
    type: normalizedType,
    amount: numAmount,
    category: category.toString().trim(),
    description: description.toString().trim(),
    date: parsedDate.toISOString().split('T')[0],
    is_voice_input: 0,
    voice_input_text: null,
    tags: parsedTags
  };
}

async function insertTransactions(db, userId, transactions) {
  const uid = Number(userId);
  if (!uid || !Number.isFinite(uid)) {
    throw new Error('Invalid userId for insertTransactions');
  }
  await db.run('BEGIN');
  try {
    const stmt = await db.prepare(`
      INSERT INTO transactions (user_id, type, amount, category, description, date, is_voice_input, voice_input_text, tags, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)
    `);
    let insertedCount = 0;
    for (const transaction of transactions) {
      await stmt.run([
        uid,
        transaction.type,
        transaction.amount,
        transaction.category,
        transaction.description,
        transaction.date,
        transaction.is_voice_input || 0,
        transaction.voice_input_text || null,
        Array.isArray(transaction.tags) ? JSON.stringify(transaction.tags) : (transaction.tags ? String(transaction.tags) : null)
      ]);
      insertedCount++;
    }
    await stmt.finalize();
    await db.run('COMMIT');
    return insertedCount;
  } catch (e) {
    await db.run('ROLLBACK');
    throw e;
  }
}

function parseWorkbook(buffer, originalname) {
  let workbook, sheetName;
  if (originalname.endsWith('.csv')) {
    const csvText = buffer.toString('utf-8');
    workbook = XLSX.read(csvText, { type: 'string' });
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  }
  sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return rawData;
}

module.exports = {
  parseTransactionRow,
  insertTransactions,
  parseWorkbook
};


