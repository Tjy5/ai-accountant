'use strict';

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { decryptApiKey } = require('../utils/encryption');
const { assertValidAiBaseUrl } = require('../utils/urlValidator');

function getLocalISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function stripCodeFences(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('```')) return t;
  const lines = t.split('\n');
  if (lines.length < 3) return t;
  const last = lines[lines.length - 1].trim();
  if (last !== '```') return t;
  return lines.slice(1, -1).join('\n').trim();
}

function extractJsonCandidate(text) {
  const t = stripCodeFences(text);
  const startObj = t.indexOf('{');
  const startArr = t.indexOf('[');
  let start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start === -1) return null;

  const endObj = t.lastIndexOf('}');
  const endArr = t.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  if (end === -1 || end <= start) return null;

  return t.slice(start, end + 1);
}

function parseAiJson(content) {
  const candidate = extractJsonCandidate(content);
  if (!candidate) {
    const err = new Error('AI 响应中未找到 JSON');
    err.status = 502;
    throw err;
  }
  try {
    return JSON.parse(candidate);
  } catch (e) {
    const err = new Error('AI 响应 JSON 解析失败');
    err.status = 502;
    err.details = { parseError: e && e.message ? e.message : String(e) };
    throw err;
  }
}

function normalizeTransaction(raw, allowedCategories, fallbackCategory, fallbackDate, warnings) {
  const tx = raw && typeof raw === 'object' ? raw : {};

  const typeRaw = String(tx.type || '').trim().toLowerCase();
  const type = typeRaw === 'income' ? 'income' : 'expense';

  let category = String(tx.category || '').trim();
  if (!category) category = fallbackCategory;
  if (!allowedCategories.has(category)) {
    warnings.push(`分类 "${category}" 不在用户分类列表中，已回退为 "${fallbackCategory}"`);
    category = fallbackCategory;
  }

  let amount = tx.amount;
  if (typeof amount === 'string') amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let description = String(tx.description || '').trim();
  if (!description) description = category || '未命名';

  let date = String(tx.date || '').trim();
  if (!date) date = fallbackDate;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) date = fallbackDate;

  const out = {
    type,
    category,
    amount,
    description,
    date
  };

  if (tx.confidence !== undefined) {
    const c = Number(tx.confidence);
    if (Number.isFinite(c) && c >= 0 && c <= 1) out.confidence = c;
  }

  if (tx.sourceSpan && typeof tx.sourceSpan === 'object') {
    const start = Number(tx.sourceSpan.start);
    const end = Number(tx.sourceSpan.end);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start) {
      out.sourceSpan = { start, end };
    }
  }

  return out;
}

module.exports = function aiRouter(db) {
  const router = express.Router();

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user && req.user.id ? String(req.user.id) : req.ip;
    }
  });

  async function handleAnalyze(req, res, next) {
    try {
      const userId = req.user.id;
      const text = req.body && typeof req.body.text === 'string' ? req.body.text.trim() : '';
      if (!text) return res.status(400).json({ error: 'text 不能为空' });
      if (text.length > 8000) return res.status(400).json({ error: 'text 过长（最多 8000 字符）' });

      const settings = await db.get(
        `SELECT api_base_url, api_key_encrypted, model, temperature, max_tokens, enabled
         FROM user_ai_settings
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );

      if (!settings || !settings.enabled) {
        return res.status(400).json({ error: 'AI 功能未启用或未配置' });
      }

      const apiBaseUrl = await assertValidAiBaseUrl(settings.api_base_url);
      const apiKey = decryptApiKey(settings.api_key_encrypted);
      if (!apiKey || !String(apiKey).trim()) {
        return res.status(400).json({ error: 'AI API Key 未配置' });
      }

      const categoriesRows = await db.all(
        'SELECT name FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY name',
        [userId]
      );
      const categoryNames = (Array.isArray(categoriesRows) ? categoriesRows : [])
        .map(r => String(r.name || '').trim())
        .filter(Boolean);
      if (!categoryNames.includes('其他')) categoryNames.push('其他');
      const allowedCategories = new Set(categoryNames);

      const prefsRows = await db.all(
        `SELECT keyword, category
         FROM user_preferences
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 100`,
        [userId]
      );
      const prefs = (Array.isArray(prefsRows) ? prefsRows : [])
        .map(p => ({ keyword: String(p.keyword || '').trim(), category: String(p.category || '').trim() }))
        .filter(p => p.keyword && p.category);

      const today = getLocalISODate();
      const fallbackCategory = '其他';

      const systemPrompt = [
        '你是一个专业的记账助手。请分析用户输入，提取所有需要记录的交易信息，并忽略与记账无关的内容。',
        '',
        '规则：',
        '1. 支出默认 type=expense，收入 type=income',
        `2. category 必须从以下列表选择（如不确定则选择"${fallbackCategory}"）：${categoryNames.join(', ')}`,
        '3. amount 必须是正数（数字）',
        `4. 日期默认 ${today}（YYYY-MM-DD），如用户明确指定则使用指定日期`,
        '5. 只返回 JSON（不要解释、不要 markdown）',
        '',
        '用户偏好（关键词 -> 分类）：',
        ...(prefs.length > 0 ? prefs.map(p => `${p.keyword} -> ${p.category}`) : ['(无)']),
        '',
        '请返回 JSON 对象，包含字段：',
        '- transactions: 数组，每个元素包含 type, category, amount, description, date，可选 confidence(0-1), sourceSpan{start,end}',
        '- ignored: 字符串数组',
        '- warnings: 字符串数组'
      ].join('\n');

      const model = String(settings.model || '').trim() || 'gpt-3.5-turbo';
      let temperature = Number(settings.temperature);
      if (!Number.isFinite(temperature)) temperature = 0.7;
      temperature = Math.min(2, Math.max(0, temperature));
      let maxTokens = Number(settings.max_tokens);
      if (!Number.isFinite(maxTokens)) maxTokens = 1000;
      maxTokens = Math.trunc(maxTokens);
      if (maxTokens < 1) maxTokens = 1;
      if (maxTokens > 20000) maxTokens = 20000;

      const endpoint = `${apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
      const payload = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      };

      const resp = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000,
        validateStatus: (s) => s >= 200 && s < 500
      });

      if (resp.status >= 400) {
        const err = new Error('AI provider request failed');
        err.status = 502;
        err.details = { status: resp.status, data: resp.data };
        throw err;
      }

      const content = resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message
        ? resp.data.choices[0].message.content
        : null;
      if (!content) {
        const err = new Error('AI 响应缺少 content');
        err.status = 502;
        throw err;
      }

      const parsed = parseAiJson(content);

      const warnings = [];
      let transactionsRaw = [];
      let ignored = [];
      let warningsFromModel = [];

      if (Array.isArray(parsed)) {
        transactionsRaw = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.transactions)) transactionsRaw = parsed.transactions;
        if (Array.isArray(parsed.ignored)) ignored = parsed.ignored.map(s => String(s));
        if (Array.isArray(parsed.warnings)) warningsFromModel = parsed.warnings.map(s => String(s));
      }

      const normalized = [];
      for (const item of transactionsRaw) {
        const n = normalizeTransaction(item, allowedCategories, fallbackCategory, today, warnings);
        if (n) normalized.push(n);
      }

      if (normalized.length === 0) {
        warnings.push('未识别到有效交易记录');
      }

      res.json({
        transactions: normalized,
        ignored: ignored || [],
        warnings: [...(warningsFromModel || []), ...warnings]
      });
    } catch (err) { return next(err); }
  }

  router.post('/ai/analyze', aiLimiter, handleAnalyze);

  router.post('/analyze-text', aiLimiter, handleAnalyze);

  return router;
};
