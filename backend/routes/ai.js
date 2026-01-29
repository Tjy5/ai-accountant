'use strict';

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { decryptApiKey } = require('../utils/encryption');
const { assertValidAiBaseUrl } = require('../utils/urlValidator');
const { TtlCache } = require('../utils/ttlCache');

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

function findBestMatchingCategory(aiCategory, categoryMap) {
  if (!aiCategory || typeof aiCategory !== 'string') return null;

  const normalized = aiCategory.trim().toLowerCase();
  if (!normalized) return null;

  // 1. 精确匹配（不区分大小写）
  for (const [name, info] of categoryMap.entries()) {
    if (name.toLowerCase() === normalized) {
      return name;
    }
  }

  // 2. 包含匹配：AI返回的分类包含在用户分类中
  for (const [name, info] of categoryMap.entries()) {
    if (name.toLowerCase().includes(normalized)) {
      return name;
    }
  }

  // 3. 被包含匹配：用户分类包含在AI返回的分类中
  for (const [name, info] of categoryMap.entries()) {
    if (normalized.includes(name.toLowerCase())) {
      return name;
    }
  }

  // 4. 描述匹配：AI返回的分类在用户分类的描述中
  for (const [name, info] of categoryMap.entries()) {
    if (info.description) {
      const desc = info.description.toLowerCase();
      if (desc.includes(normalized) || normalized.includes(desc)) {
        return name;
      }
    }
  }

  // 5. 编辑距离匹配（简单版本）
  let bestMatch = null;
  let minDistance = Infinity;

  for (const [name, info] of categoryMap.entries()) {
    const distance = levenshteinDistance(normalized, name.toLowerCase());
    // 如果编辑距离小于等于2，且相似度大于60%，认为是匹配的
    if (distance <= 2 && distance < minDistance) {
      const similarity = 1 - distance / Math.max(normalized.length, name.length);
      if (similarity > 0.6) {
        minDistance = distance;
        bestMatch = name;
      }
    }
  }

  return bestMatch;
}

function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function normalizeTransaction(raw, allowedCategories, fallbackCategory, fallbackDate, warnings, categoryMap) {
  const tx = raw && typeof raw === 'object' ? raw : {};

  const typeRaw = String(tx.type || '').trim().toLowerCase();
  const type = typeRaw === 'income' ? 'income' : 'expense';

  let category = String(tx.category || '').trim();
  if (!category) category = fallbackCategory;

  // 使用模糊匹配查找最佳分类
  if (!allowedCategories.has(category)) {
    const bestMatch = categoryMap ? findBestMatchingCategory(category, categoryMap) : null;
    if (bestMatch) {
      warnings.push(`分类 "${category}" 已智能匹配为 "${bestMatch}"`);
      category = bestMatch;
    } else {
      warnings.push(`分类 "${category}" 不在用户分类列表中，已回退为 "${fallbackCategory}"`);
      category = fallbackCategory;
    }
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

  const settingsCache = new TtlCache({ maxItems: 2000, defaultTtlMs: 10_000 });
  const categoriesCache = new TtlCache({ maxItems: 2000, defaultTtlMs: 20_000 });
  const preferencesCache = new TtlCache({ maxItems: 2000, defaultTtlMs: 20_000 });

  async function getUserAiSettings(userId) {
    const key = `aiSettings:${userId}`;
    const cached = settingsCache.get(key);
    if (cached) return cached;
    const row = await db.get(
      `SELECT api_base_url, api_key_encrypted, model, temperature, max_tokens, enabled
       FROM user_ai_settings
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );
    settingsCache.set(key, row || null);
    return row || null;
  }

  async function getUserCategories(userId) {
    const key = `categories:${userId}`;
    const cached = categoriesCache.get(key);
    if (cached) return cached;
    const rows = await db.all(
      'SELECT name, description, type FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
    const categoryMap = new Map();
    for (const r of (Array.isArray(rows) ? rows : [])) {
      const name = String(r.name || '').trim();
      if (name) {
        categoryMap.set(name, {
          description: r.description ? String(r.description).trim() : '',
          type: r.type || 'expense'
        });
      }
    }
    categoriesCache.set(key, categoryMap);
    return categoryMap;
  }

  async function getUserKeywordPreferences(userId) {
    const key = `prefs:${userId}`;
    const cached = preferencesCache.get(key);
    if (cached) return cached;
    const rows = await db.all(
      `SELECT keyword, category
       FROM user_preferences
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 100`,
      [userId]
    );
    const prefs = (Array.isArray(rows) ? rows : [])
      .map(p => ({ keyword: String(p.keyword || '').trim(), category: String(p.category || '').trim() }))
      .filter(p => p.keyword && p.category);
    preferencesCache.set(key, prefs);
    return prefs;
  }

  function wantsSse(req) {
    const accept = typeof req.headers.accept === 'string' ? req.headers.accept : '';
    if (accept.includes('text/event-stream')) return true;
    const q = req.query && typeof req.query.stream !== 'undefined' ? String(req.query.stream) : '';
    if (q === '1' || q.toLowerCase() === 'true') return true;
    return false;
  }

  function initSse(res) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Prevent some proxies from buffering SSE
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
  }

  function writeSse(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function createJsonStringFieldExtractor(fieldName) {
    const key = `"${String(fieldName)}"`;
    let matchIdx = 0;
    let state = 'seekKey'; // seekKey -> seekColon -> seekQuote -> capture -> done
    let escape = false;
    let unicodeRemaining = 0;
    let unicodeHex = '';

    const escapeMap = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\', '/': '/' };

    const resetToSeekKey = () => {
      matchIdx = 0;
      state = 'seekKey';
      escape = false;
      unicodeRemaining = 0;
      unicodeHex = '';
    };

    const feed = (textChunk) => {
      const s = String(textChunk || '');
      let out = '';

      for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (state === 'done') break;

        if (state === 'seekKey') {
          if (ch === key[matchIdx]) {
            matchIdx++;
            if (matchIdx === key.length) {
              state = 'seekColon';
              matchIdx = 0;
            }
          } else {
            matchIdx = ch === key[0] ? 1 : 0;
          }
          continue;
        }

        if (state === 'seekColon') {
          if (ch === ':') {
            state = 'seekQuote';
            continue;
          }
          if (/\s/.test(ch)) continue;
          // Unexpected token, restart search
          resetToSeekKey();
          continue;
        }

        if (state === 'seekQuote') {
          if (ch === '"') {
            state = 'capture';
            escape = false;
            unicodeRemaining = 0;
            unicodeHex = '';
            continue;
          }
          if (/\s/.test(ch)) continue;
          // Not a string value
          resetToSeekKey();
          continue;
        }

        if (state === 'capture') {
          if (unicodeRemaining > 0) {
            if (!/[0-9a-fA-F]/.test(ch)) {
              // invalid unicode escape; stop capturing to avoid corrupt output
              state = 'done';
              break;
            }
            unicodeHex += ch;
            unicodeRemaining--;
            if (unicodeRemaining === 0) {
              const code = parseInt(unicodeHex, 16);
              if (Number.isFinite(code)) out += String.fromCharCode(code);
              unicodeHex = '';
            }
            continue;
          }

          if (escape) {
            escape = false;
            if (ch === 'u') {
              unicodeRemaining = 4;
              unicodeHex = '';
              continue;
            }
            out += Object.prototype.hasOwnProperty.call(escapeMap, ch) ? escapeMap[ch] : ch;
            continue;
          }

          if (ch === '\\') {
            escape = true;
            continue;
          }
          if (ch === '"') {
            state = 'done';
            break;
          }
          out += ch;
        }
      }

      return out;
    };

    return { feed };
  }

  function buildChatResponseFromContent(content, options = {}) {
    const allowedCategories = options.allowedCategories instanceof Set ? options.allowedCategories : new Set();
    const fallbackCategory = typeof options.fallbackCategory === 'string' ? options.fallbackCategory : '其他';
    const today = typeof options.today === 'string' ? options.today : getLocalISODate();
    const warnings = Array.isArray(options.warnings) ? options.warnings : [];

    let parsed = null;
    try {
      parsed = parseAiJson(content);
    } catch (e) {
      warnings.push('AI 响应未返回可解析的 JSON，已降级为普通回复');
      const reply = String(content || '').trim();
      return {
        reply,
        replyType: 'text',
        messages: reply ? [{ type: 'text', content: reply }] : [],
        intent: 'chit_chat',
        drafts: [],
        needsClarification: false,
        clarificationQuestion: null,
        warnings,
        ignored: [],
        timestamp: Date.now(),
      };
    }

    const allowedIntents = new Set(['bookkeeping', 'update_draft', 'clarification', 'query', 'chit_chat']);
    const allowedMessageTypes = new Set(['text', 'image', 'chart']);

    let reply = '';
    let intent = 'chit_chat';
    let draftsRaw = [];
    let needsClarification = false;
    let clarificationQuestion = null;
    let warningsFromModel = [];
    let ignored = [];
    let messagesOut = [];

    if (Array.isArray(parsed)) {
      draftsRaw = parsed;
      intent = 'bookkeeping';
    } else if (parsed && typeof parsed === 'object') {
      reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';

      const intentRaw = typeof parsed.intent === 'string' ? parsed.intent.trim() : '';
      if (intentRaw && allowedIntents.has(intentRaw)) intent = intentRaw;
      else if (intentRaw) warnings.push(`未知 intent "${intentRaw}"，已回退为 "chit_chat"`);

      if (Array.isArray(parsed.drafts)) draftsRaw = parsed.drafts;
      else if (Array.isArray(parsed.transactions)) draftsRaw = parsed.transactions;

      needsClarification = Boolean(parsed.needsClarification) || intent === 'clarification';
      clarificationQuestion = typeof parsed.clarificationQuestion === 'string' ? parsed.clarificationQuestion.trim() : null;

      if (Array.isArray(parsed.warnings)) warningsFromModel = parsed.warnings.map(s => String(s)).filter(Boolean);
      if (Array.isArray(parsed.ignored)) ignored = parsed.ignored.map(s => String(s)).filter(Boolean);

      if (Array.isArray(parsed.messages)) {
        for (const m of parsed.messages) {
          if (!m || typeof m !== 'object') continue;
          const typeRaw = typeof m.type === 'string' ? m.type.trim().toLowerCase() : 'text';
          const type = allowedMessageTypes.has(typeRaw) ? typeRaw : 'text';
          const text = typeof m.content === 'string' ? m.content.trim() : '';
          const data = m.data && typeof m.data === 'object' ? m.data : null;
          if (!text && !data) continue;
          messagesOut.push({ type, content: text, ...(data ? { data } : {}) });
        }
      }
    }

    const normalizedDrafts = [];
    const ts = Date.now();
    for (let i = 0; i < (Array.isArray(draftsRaw) ? draftsRaw.length : 0); i++) {
      const raw = draftsRaw[i];
      const n = normalizeTransaction(raw, allowedCategories, fallbackCategory, today, warnings, options.categoryMap);
      if (!n) continue;

      let draftId = '';
      if (raw && typeof raw === 'object' && typeof raw._draftId === 'string') draftId = raw._draftId.trim();
      if (!draftId) draftId = `draft_${ts}_${i}`;

      const out = { _draftId: draftId, ...n };
      if (raw && typeof raw === 'object' && Array.isArray(raw.tags)) {
        const tags = raw.tags.map(t => String(t)).map(t => t.trim()).filter(Boolean).slice(0, 20);
        if (tags.length > 0) out.tags = tags;
      }
      normalizedDrafts.push(out);
    }

    if (needsClarification) {
      intent = 'clarification';
      if (!clarificationQuestion && reply) clarificationQuestion = reply;
    } else {
      clarificationQuestion = null;
    }

    const draftsOut = needsClarification ? [] : normalizedDrafts;
    if (needsClarification && normalizedDrafts.length > 0) {
      warnings.push('needsClarification=true 时已忽略 drafts');
    }

    if (messagesOut.length === 0 && reply) {
      messagesOut = [{ type: 'text', content: reply }];
    }

    return {
      reply,
      replyType: messagesOut[0] && messagesOut[0].type ? messagesOut[0].type : 'text',
      messages: messagesOut,
      intent,
      drafts: draftsOut,
      needsClarification,
      clarificationQuestion,
      warnings: [...(warningsFromModel || []), ...(warnings || [])],
      ignored: ignored || [],
      timestamp: Date.now(),
    };
  }

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
        'SELECT name, description, type FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY name',
        [userId]
      );
      const categoryMap = new Map();
      const categoryNames = [];
      for (const r of (Array.isArray(categoriesRows) ? categoriesRows : [])) {
        const name = String(r.name || '').trim();
        if (name) {
          categoryNames.push(name);
          categoryMap.set(name, {
            description: r.description ? String(r.description).trim() : '',
            type: r.type || 'expense'
          });
        }
      }
      if (!categoryNames.includes('其他')) {
        categoryNames.push('其他');
        categoryMap.set('其他', { description: '其他未分类项目', type: 'both' });
      }
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
        `2. category 必须从以下分类中选择最合适的（如不确定则选择"${fallbackCategory}"）：`,
        ...categoryNames.map(name => {
          const info = categoryMap.get(name);
          return info && info.description
            ? `   - ${name}（${info.description}）`
            : `   - ${name}`;
        }),
        '3. amount 必须是正数（数字）',
        `4. 日期默认 ${today}（YYYY-MM-DD），如用户明确指定则使用指定日期`,
        '5. 只返回 JSON（不要解释、不要 markdown）',
        '',
        '用户偏好（关键词 -> 分类）：',
        ...(prefs.length > 0 ? prefs.map(p => `- "${p.keyword}" -> ${p.category}`) : ['(无)']),
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
        const n = normalizeTransaction(item, allowedCategories, fallbackCategory, today, warnings, categoryMap);
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

  // ========== AI Chat ==========
  router.post('/ai/chat', aiLimiter, async (req, res, next) => {
    try {
      const userId = req.user.id;
      const body = req.body || {};

      const clearContext = Boolean(body.clearContext);

      const messagesIn = Array.isArray(body.messages) ? body.messages : null;
      // Allow client to "clear" without sending a new message (server is stateless today)
      if ((!messagesIn || messagesIn.length === 0) && clearContext) {
        return res.status(204).send();
      }
      if (!messagesIn || messagesIn.length === 0) {
        return res.status(400).json({ error: 'messages 不能为空' });
      }

      const warnings = [];

      // Normalize messages (keep last N to avoid huge payloads)
      const MAX_MESSAGES = 30;
      const MAX_MESSAGE_LEN = 8000;
      let chatMessages = [];

      for (const m of messagesIn.slice(-MAX_MESSAGES)) {
        if (!m || typeof m !== 'object') continue;
        const roleRaw = String(m.role || '').trim().toLowerCase();
        const role = roleRaw === 'assistant' ? 'assistant' : (roleRaw === 'user' ? 'user' : null);
        if (!role) continue;
        let content = typeof m.content === 'string' ? m.content.trim() : '';
        if (!content) continue;
        if (content.length > MAX_MESSAGE_LEN) {
          warnings.push(`messages[].content 过长，已截断为 ${MAX_MESSAGE_LEN} 字符`);
          content = content.slice(0, MAX_MESSAGE_LEN);
        }
        chatMessages.push({ role, content });
      }

      if (chatMessages.length === 0) {
        return res.status(400).json({ error: 'messages 无有效内容' });
      }

      // If client requests clearing context, keep only the last user message (fallback: last message)
      if (clearContext) {
        const lastUser = [...chatMessages].reverse().find(m => m.role === 'user');
        chatMessages = lastUser ? [lastUser] : [chatMessages[chatMessages.length - 1]];
      }

      const clientContext = body.clientContext && typeof body.clientContext === 'object' ? body.clientContext : {};
      const nowRaw = typeof clientContext.now === 'string' ? clientContext.now.trim() : '';
      let today = getLocalISODate();
      if (/^\d{4}-\d{2}-\d{2}/.test(nowRaw)) {
        today = nowRaw.slice(0, 10);
      }

      const pendingDraftsIn = !clearContext && Array.isArray(body.pendingDrafts) ? body.pendingDrafts : [];
      const pendingDrafts = (Array.isArray(pendingDraftsIn) ? pendingDraftsIn : [])
        .slice(-20)
        .map((d) => {
          if (!d || typeof d !== 'object') return null;
          const out = {};
          const id = typeof d._draftId === 'string' ? d._draftId.trim() : '';
          if (id) out._draftId = id;
          const typeRaw = String(d.type || '').trim().toLowerCase();
          if (typeRaw === 'income' || typeRaw === 'expense') out.type = typeRaw;
          const category = typeof d.category === 'string' ? d.category.trim() : '';
          if (category) out.category = category;
          const amount = typeof d.amount === 'string' ? Number(d.amount) : Number(d.amount);
          if (Number.isFinite(amount) && amount > 0) out.amount = amount;
          const description = typeof d.description === 'string' ? d.description.trim() : '';
          if (description) out.description = description.slice(0, 200);
          const date = typeof d.date === 'string' ? d.date.trim() : '';
          if (date) out.date = date.slice(0, 10);
          const confidence = d.confidence !== undefined ? Number(d.confidence) : null;
          if (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) out.confidence = confidence;
          return Object.keys(out).length > 0 ? out : null;
        })
        .filter(Boolean);

      const settings = await getUserAiSettings(userId);

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

      // Load user categories and preferences for prompt injection
      const categoryMap = await getUserCategories(userId);
      const categoryNames = [...categoryMap.keys()];
      if (!categoryNames.includes('其他')) {
        categoryNames.push('其他');
        categoryMap.set('其他', { description: '其他未分类项目', type: 'both' });
      }
      const allowedCategories = new Set(categoryNames);
      const fallbackCategory = '其他';

      const prefs = await getUserKeywordPreferences(userId);

      const systemPrompt = [
        '你是一个专业的记账助手，擅长自然对话和智能记账。',
        '',
        '## 你的职责',
        '1. 与用户友好对话，理解记账需求',
        '2. 从对话中提取交易信息（金额、类别、日期、备注）',
        '3. 引导用户提供缺失的记账信息',
        '4. 支持多轮对话修正（结合 pendingDrafts）',
        '',
        '## 记账规则',
        '- 支出默认 type=expense，收入 type=income',
        `- 类别必须从以下分类中选择最合适的（无法匹配则使用"${fallbackCategory}"）：`,
        ...categoryNames.map(name => {
          const info = categoryMap.get(name);
          return info && info.description
            ? `  - ${name}（${info.description}）`
            : `  - ${name}`;
        }),
        '- amount 必须是正数（数字）',
        `- 日期默认 ${today}（YYYY-MM-DD），如用户明确指定则使用指定日期`,
        '',
        '## 用户习惯映射（keyword -> category）',
        ...(prefs.length > 0 ? prefs.map(p => `- "${p.keyword}" -> ${p.category}`) : ['(无)']),
        '',
        '## pendingDrafts（客户端待确认草稿，可能被用户修正）',
        ...(pendingDrafts.length > 0 ? [JSON.stringify(pendingDrafts)] : ['(无)']),
        '',
        '## clientContext（仅用于帮助理解日期/时区等）',
        ...(clientContext && Object.keys(clientContext).length > 0 ? [JSON.stringify(clientContext)] : ['(无)']),
        '',
        '## 输出格式（严格 JSON，不要 markdown，不要额外说明）',
        '{',
        '  "reply": "给用户的自然语言回复",',
        '  "intent": "bookkeeping | update_draft | clarification | query | chit_chat",',
        '  "drafts": [',
        '    { "_draftId": "可选", "type": "expense | income", "category": "类别名称", "amount": 12.34, "description": "备注", "date": "YYYY-MM-DD", "confidence": 0.0 }',
        '  ],',
        '  "needsClarification": true/false,',
        '  "clarificationQuestion": "追问内容（如果需要）",',
        '  "warnings": ["警告信息"],',
        '  "ignored": ["被忽略的内容"]',
        '}',
        '',
        '## 重要规则',
        '1. 信息不全时，先追问，不要猜测生成草稿（drafts 应为空）',
        '2. 用户修正时（如"不对，是60"），结合 pendingDrafts 和上下文更新草稿，并输出 intent=update_draft',
        '3. 一条消息可能包含多笔交易（如"咖啡30，打车50"）',
        '4. reply 保持简洁友好'
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
          ...chatMessages
        ]
      };

      const stream = wantsSse(req);
      if (stream) {
        initSse(res);
        writeSse(res, 'start', { type: 'text' });

        const extractor = createJsonStringFieldExtractor('reply');
        let providerStream = null;
        let closed = false;
        const onClose = () => {
          closed = true;
          if (providerStream && typeof providerStream.destroy === 'function') providerStream.destroy();
        };
        req.on('close', onClose);

        const streamToString = (readable) => new Promise((resolve, reject) => {
          let out = '';
          readable.on('data', (chunk) => { out += chunk.toString('utf8'); });
          readable.on('end', () => resolve(out));
          readable.on('error', reject);
        });

        try {
          const resp = await axios.post(endpoint, { ...payload, stream: true }, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000,
            validateStatus: (s) => s >= 200 && s < 500,
            responseType: 'stream'
          });

          if (resp.status >= 400) {
            let details = null;
            try {
              const raw = await streamToString(resp.data);
              details = raw ? raw.slice(0, 2000) : null;
            } catch {}
            writeSse(res, 'error', { error: 'AI provider request failed', status: resp.status, details });
            return res.end();
          }

          const contentType = String(resp.headers && resp.headers['content-type'] ? resp.headers['content-type'] : '');
          // Some providers ignore `stream: true` and still return JSON.
          if (!contentType.includes('text/event-stream')) {
            const raw = await streamToString(resp.data);
            let data = null;
            try { data = JSON.parse(raw); } catch {}
            const content = data && data.choices && data.choices[0] && data.choices[0].message
              ? data.choices[0].message.content
              : null;
            if (!content) {
              writeSse(res, 'error', { error: 'AI 响应缺少 content' });
              return res.end();
            }

            const out = buildChatResponseFromContent(content, { warnings, allowedCategories, fallbackCategory, today, categoryMap });
            const replyText = typeof out.reply === 'string' ? out.reply : '';
            for (let i = 0; i < replyText.length && !closed; i += 24) {
              writeSse(res, 'delta', { type: 'text', delta: replyText.slice(i, i + 24) });
            }
            writeSse(res, 'final', out);
            return res.end();
          }

          providerStream = resp.data;
          let fullContent = '';
          await new Promise((resolve, reject) => {
            let buffer = '';
            let done = false;

            const cleanup = () => {
              providerStream.removeAllListeners('data');
              providerStream.removeAllListeners('end');
              providerStream.removeAllListeners('error');
            };

            providerStream.on('data', (chunk) => {
              if (closed || done) return;
              buffer += chunk.toString('utf8');

              let idx;
              while ((idx = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line || !line.startsWith('data:')) continue;

                const dataStr = line.slice(5).trim();
                if (!dataStr) continue;
                if (dataStr === '[DONE]') {
                  done = true;
                  cleanup();
                  resolve();
                  return;
                }

                let parsed;
                try { parsed = JSON.parse(dataStr); } catch { continue; }
                const delta = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta
                  ? parsed.choices[0].delta.content
                  : null;
                if (typeof delta === 'string' && delta.length > 0) {
                  fullContent += delta;
                  const extracted = extractor.feed(delta);
                  if (extracted) writeSse(res, 'delta', { type: 'text', delta: extracted });
                }
              }
            });

            providerStream.on('end', () => {
              if (done) return;
              done = true;
              cleanup();
              resolve();
            });

            providerStream.on('error', (e) => {
              if (done) return;
              done = true;
              cleanup();
              reject(e);
            });
          });

          const out = buildChatResponseFromContent(fullContent, { warnings, allowedCategories, fallbackCategory, today, categoryMap });
          writeSse(res, 'final', out);
          return res.end();
        } catch (e) {
          const msg = e && e.message ? String(e.message) : 'AI streaming failed';
          if (!closed) {
            writeSse(res, 'error', { error: msg });
            res.end();
          }
          return;
        } finally {
          req.removeListener('close', onClose);
        }
      }

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

      const out = buildChatResponseFromContent(content, { warnings, allowedCategories, fallbackCategory, today, categoryMap });
      res.json(out);
    } catch (err) { return next(err); }
  });

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
        'SELECT name, description, type FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY name',
        [userId]
      );
      const categoryMap = new Map();
      const categoryNames = [];
      for (const r of (Array.isArray(categoriesRows) ? categoriesRows : [])) {
        const name = String(r.name || '').trim();
        if (name) {
          categoryNames.push(name);
          categoryMap.set(name, {
            description: r.description ? String(r.description).trim() : '',
            type: r.type || 'expense'
          });
        }
      }
      if (!categoryNames.includes('其他')) {
        categoryNames.push('其他');
        categoryMap.set('其他', { description: '其他未分类项目', type: 'both' });
      }

      const today = getLocalISODate();

      const systemPrompt = [
        '你是一个专业的记账助手。请分析用户上传的票据/收据图片，提取交易信息。',
        '',
        '规则：',
        '1. 支出默认 type=expense，收入 type=income',
        `2. category 必须从以下分类中选择最合适的（如不确定则选择"其他"）：`,
        ...categoryNames.map(name => {
          const info = categoryMap.get(name);
          return info && info.description
            ? `   - ${name}（${info.description}）`
            : `   - ${name}`;
        }),
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
        const n = normalizeTransaction(item, allowedCategories, fallbackCategory, today, warnings, categoryMap);
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
