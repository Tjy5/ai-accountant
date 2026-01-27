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
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m && m[1]) return String(m[1]).trim();
  return t;
}

function extractJsonSlice(text, start) {
  const t = String(text || '');
  const open = t[start];
  if (open !== '{' && open !== '[') return null;

  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < t.length; i++) {
    const ch = t[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }

  return null;
}

function parseAiJson(content) {
  const t = stripCodeFences(content);
  let lastParseError = null;

  for (let start = 0; start < t.length; start++) {
    const ch = t[start];
    if (ch !== '{' && ch !== '[') continue;

    const candidate = extractJsonSlice(t, start);
    if (!candidate) continue;

    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastParseError = e && e.message ? String(e.message) : String(e);
      // Retry: remove common trailing commas
      try {
        const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch (e2) {
        lastParseError = e2 && e2.message ? String(e2.message) : lastParseError;
        // continue scanning for the next possible JSON block
      }
    }
  }

  const err = new Error(t.includes('{') || t.includes('[') ? 'AI 响应 JSON 解析失败' : 'AI 响应中未找到 JSON');
  err.status = 502;
  err.details = { preview: String(t || '').slice(0, 200), ...(lastParseError ? { parseError: lastParseError } : {}) };
  throw err;
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

  const MAX_AUDIO_BASE64 = 8 * 1024 * 1024; // keep below server JSON limit (10mb)
  const MAX_IMAGE_BASE64 = 8 * 1024 * 1024; // keep below server JSON limit (10mb)

  const ALLOWED_AUDIO_FORMATS = new Set(['m4a', 'mp3', 'wav', 'webm', 'ogg', 'mp4']);
  const AUDIO_MIME_BY_FORMAT = {
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
  };

  function guessImageMimeFromBase64(b64) {
    const head = String(b64 || '').trim().slice(0, 24);
    if (head.startsWith('/9j/')) return 'image/jpeg';
    if (head.startsWith('iVBORw0KGgo')) return 'image/png';
    if (head.startsWith('R0lGOD')) return 'image/gif';
    if (head.startsWith('UklGR')) return 'image/webp';
    return 'image/jpeg';
  }

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user && req.user.id ? String(req.user.id) : 'unknown';
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

      const encryptedKey = settings.api_key_encrypted;
      if (!encryptedKey || !String(encryptedKey).trim()) {
        return res.status(400).json({ error: 'AI API Key 未配置' });
      }
      let apiKey;
      try {
        apiKey = decryptApiKey(encryptedKey);
      } catch (e) {
        const err = new Error('AI API Key 无效，请重新配置');
        err.status = 400;
        throw err;
      }
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
        timeout: 60000,
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

  // ========== Voice Transcription (Whisper API) ==========
  router.post('/ai/transcribe', aiLimiter, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { audio, format = 'm4a' } = req.body || {};

      if (!audio || typeof audio !== 'string') {
        return res.status(400).json({ error: 'audio (base64) 不能为空' });
      }
      if (audio.length > MAX_AUDIO_BASE64) {
        return res.status(400).json({ error: '音频过大（最大 8MB base64）' });
      }

      const fmt = String(format || '').trim().toLowerCase();
      if (!ALLOWED_AUDIO_FORMATS.has(fmt)) {
        return res.status(400).json({ error: `format 不支持（允许：${Array.from(ALLOWED_AUDIO_FORMATS).join(', ')}）` });
      }

      const settings = await db.get(
        `SELECT api_base_url, api_key_encrypted, model, enabled
         FROM user_ai_settings
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );

      if (!settings || !settings.enabled) {
        return res.status(400).json({ error: 'AI 功能未启用或未配置' });
      }

      const apiBaseUrl = await assertValidAiBaseUrl(settings.api_base_url);

      const encryptedKey = settings.api_key_encrypted;
      if (!encryptedKey || !String(encryptedKey).trim()) {
        return res.status(400).json({ error: 'AI API Key 未配置' });
      }
      let apiKey;
      try {
        apiKey = decryptApiKey(encryptedKey);
      } catch (e) {
        const err = new Error('AI API Key 无效，请重新配置');
        err.status = 400;
        throw err;
      }
      if (!apiKey || !String(apiKey).trim()) {
        return res.status(400).json({ error: 'AI API Key 未配置' });
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audio, 'base64');

      // Create form data for Whisper API
      const FormData = require('form-data');
      const formData = new FormData();
      const contentType = AUDIO_MIME_BY_FORMAT[fmt] || `audio/${fmt}`;
      formData.append('file', audioBuffer, { filename: `audio.${fmt}`, contentType });
      formData.append('model', 'whisper-1');
      formData.append('language', 'zh');

      const endpoint = `${apiBaseUrl.replace(/\/+$/, '')}/audio/transcriptions`;

      const resp = await axios.post(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        timeout: 60000,
        validateStatus: (s) => s >= 200 && s < 500
      });

      if (resp.status >= 400) {
        const err = new Error('Whisper API request failed');
        err.status = 502;
        err.details = { status: resp.status, data: resp.data };
        throw err;
      }

      const text = resp.data && resp.data.text ? String(resp.data.text).trim() : '';

      res.json({ text });
    } catch (err) { return next(err); }
  });

  // ========== Image OCR Analysis (GPT-4 Vision) ==========
  router.post('/ai/analyze-image', aiLimiter, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { image } = req.body || {};

      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'image (base64) 不能为空' });
      }

      // Allow "data:*;base64,..." inputs
      let imageBase64 = String(image).trim();
      let imageMime = 'image/jpeg';
      const dataUrlMatch = imageBase64.match(/^data:([^;]+);base64,(.*)$/i);
      if (dataUrlMatch) {
        imageMime = dataUrlMatch[1] || imageMime;
        imageBase64 = dataUrlMatch[2] || '';
      } else {
        imageMime = guessImageMimeFromBase64(imageBase64);
      }

      // Limit image size (keep below server JSON limit)
      if (imageBase64.length > MAX_IMAGE_BASE64) {
        return res.status(400).json({ error: '图片过大（最大 8MB base64）' });
      }

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

      const encryptedKey = settings.api_key_encrypted;
      if (!encryptedKey || !String(encryptedKey).trim()) {
        return res.status(400).json({ error: 'AI API Key 未配置' });
      }
      let apiKey;
      try {
        apiKey = decryptApiKey(encryptedKey);
      } catch (e) {
        const err = new Error('AI API Key 无效，请重新配置');
        err.status = 400;
        throw err;
      }
      if (!apiKey || !String(apiKey).trim()) {
        return res.status(400).json({ error: 'AI API Key 未配置' });
      }

      // Get user categories
      const categoriesRows = await db.all(
        'SELECT name FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY name',
        [userId]
      );
      const categoryNames = (Array.isArray(categoriesRows) ? categoriesRows : [])
        .map(r => String(r.name || '').trim())
        .filter(Boolean);
      if (!categoryNames.includes('其他')) categoryNames.push('其他');

      const today = getLocalISODate();

      const systemPrompt = [
        '你是一个专业的记账助手。请分析用户上传的票据/收据图片，提取交易信息。',
        '',
        '规则：',
        '1. 支出默认 type=expense，收入 type=income',
        `2. category 必须从以下列表选择（如不确定则选择"其他"）：${categoryNames.join(', ')}`,
        '3. amount 必须是正数（数字）',
        `4. 日期默认 ${today}（YYYY-MM-DD），如票据上有日期则使用票据日期`,
        '5. 只返回 JSON（不要解释、不要 markdown）',
        '',
        '请返回 JSON 对象，包含字段：',
        '- transactions: 数组，每个元素包含 type, category, amount, description, date',
        '- ignored: 字符串数组（无法识别的内容）',
        '- warnings: 字符串数组（提示信息）'
      ].join('\n');

      // Use configured model (must support vision for image analysis)
      const model = String(settings.model || '').trim() || 'gpt-4o';
      let temperature = Number(settings.temperature);
      if (!Number.isFinite(temperature)) temperature = 0.3;
      temperature = Math.min(2, Math.max(0, temperature));
      let maxTokens = Number(settings.max_tokens);
      if (!Number.isFinite(maxTokens)) maxTokens = 2000;
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
          {
            role: 'user',
            content: [
              { type: 'text', text: '请分析这张票据/收据，提取交易信息：' },
              { type: 'image_url', image_url: { url: `data:${imageMime};base64,${imageBase64}` } }
            ]
          }
        ]
      };

      const resp = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000,
        validateStatus: (s) => s >= 200 && s < 500
      });

      if (resp.status >= 400) {
        const err = new Error('Vision API request failed');
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
      const allowedCategories = new Set(categoryNames);
      const fallbackCategory = '其他';
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
  });

  return router;
};
