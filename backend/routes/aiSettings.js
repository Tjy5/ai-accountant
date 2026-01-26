'use strict';

const express = require('express');
const { encryptApiKey } = require('../utils/encryption');
const { assertValidAiBaseUrl } = require('../utils/urlValidator');

const DEFAULTS = {
  apiBaseUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
  enabled: false
};

const MAX_TEMPERATURE = 2;
const MIN_TEMPERATURE = 0;
const MAX_MAX_TOKENS = 20000;
const MIN_MAX_TOKENS = 1;

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  return false;
}

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = function aiSettingsRouter(db) {
  const router = express.Router();

  router.get('/ai/settings', async (req, res, next) => {
    try {
      const userId = req.user.id;

      const row = await db.get(
        `SELECT api_base_url, api_key_encrypted, model, temperature, max_tokens, enabled
         FROM user_ai_settings
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );

      if (!row) {
        return res.json({
          settings: {
            ...DEFAULTS,
            apiKey: ''
          }
        });
      }

      res.json({
        settings: {
          apiBaseUrl: row.api_base_url || DEFAULTS.apiBaseUrl,
          apiKey: row.api_key_encrypted ? '********' : '',
          model: row.model || DEFAULTS.model,
          temperature: Number.isFinite(Number(row.temperature)) ? Number(row.temperature) : DEFAULTS.temperature,
          maxTokens: Number.isFinite(Number(row.max_tokens)) ? Number(row.max_tokens) : DEFAULTS.maxTokens,
          enabled: Boolean(row.enabled)
        }
      });
    } catch (err) { return next(err); }
  });

  router.put('/ai/settings', async (req, res, next) => {
    try {
      const userId = req.user.id;
      const body = req.body || {};

      const incomingBaseUrl = body.apiBaseUrl ?? body.api_base_url;
      const incomingApiKey = body.apiKey ?? body.api_key;
      const incomingModel = body.model;
      const incomingTemperature = body.temperature;
      const incomingMaxTokens = body.maxTokens ?? body.max_tokens;
      const incomingEnabled = body.enabled;

      const existing = await db.get(
        'SELECT user_id, api_key_encrypted, deleted_at FROM user_ai_settings WHERE user_id = ?',
        [userId]
      );

      const setClauses = [];
      const params = [];

      if (incomingBaseUrl !== undefined) {
        const normalized = await assertValidAiBaseUrl(String(incomingBaseUrl));
        setClauses.push('api_base_url = ?');
        params.push(normalized);
      }

      if (incomingModel !== undefined) {
        const m = String(incomingModel || '').trim();
        if (!m) return res.status(400).json({ error: 'model 不能为空' });
        setClauses.push('model = ?');
        params.push(m);
      }

      if (incomingTemperature !== undefined) {
        const t = toNumberOrNull(incomingTemperature);
        if (t === null || t < MIN_TEMPERATURE || t > MAX_TEMPERATURE) return res.status(400).json({ error: `temperature 无效 (${MIN_TEMPERATURE}-${MAX_TEMPERATURE})` });
        setClauses.push('temperature = ?');
        params.push(t);
      }

      if (incomingMaxTokens !== undefined) {
        const mt = toNumberOrNull(incomingMaxTokens);
        if (mt === null || !Number.isInteger(mt) || mt < MIN_MAX_TOKENS || mt > MAX_MAX_TOKENS) return res.status(400).json({ error: `maxTokens 无效 (${MIN_MAX_TOKENS}-${MAX_MAX_TOKENS})` });
        setClauses.push('max_tokens = ?');
        params.push(mt);
      }

      if (incomingEnabled !== undefined) {
        setClauses.push('enabled = ?');
        params.push(toBool(incomingEnabled) ? 1 : 0);
      }

      if (incomingApiKey !== undefined) {
        const k = String(incomingApiKey || '').trim();
        if (k && !k.includes('*')) {
          const encrypted = encryptApiKey(k);
          setClauses.push('api_key_encrypted = ?');
          params.push(encrypted);
        }
      }

      if (!existing) {
        const baseUrl = incomingBaseUrl !== undefined ? await assertValidAiBaseUrl(String(incomingBaseUrl)) : DEFAULTS.apiBaseUrl;

        let model = DEFAULTS.model;
        if (incomingModel !== undefined) {
          const m = String(incomingModel || '').trim();
          if (!m) return res.status(400).json({ error: 'model 不能为空' });
          model = m;
        }

        let temperature = DEFAULTS.temperature;
        if (incomingTemperature !== undefined) {
          const t = toNumberOrNull(incomingTemperature);
          if (t === null || t < MIN_TEMPERATURE || t > MAX_TEMPERATURE) return res.status(400).json({ error: `temperature 无效 (${MIN_TEMPERATURE}-${MAX_TEMPERATURE})` });
          temperature = t;
        }

        let maxTokens = DEFAULTS.maxTokens;
        if (incomingMaxTokens !== undefined) {
          const mt = toNumberOrNull(incomingMaxTokens);
          if (mt === null || !Number.isInteger(mt) || mt < MIN_MAX_TOKENS || mt > MAX_MAX_TOKENS) return res.status(400).json({ error: `maxTokens 无效 (${MIN_MAX_TOKENS}-${MAX_MAX_TOKENS})` });
          maxTokens = mt;
        }

        const enabled = incomingEnabled !== undefined ? (toBool(incomingEnabled) ? 1 : 0) : 1;

        const apiKey = String(incomingApiKey || '').trim();
        if (!apiKey || apiKey.includes('*')) {
          return res.status(400).json({ error: '首次配置必须提供 apiKey' });
        }

        await db.run(
          `INSERT INTO user_ai_settings (user_id, api_base_url, api_key_encrypted, model, temperature, max_tokens, enabled, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)`,
          [userId, baseUrl, encryptApiKey(apiKey), model, temperature, maxTokens, enabled]
        );
      } else {
        if (existing.deleted_at) {
          setClauses.push('deleted_at = NULL');
        }
        if (setClauses.length === 0) {
          return res.status(400).json({ error: '没有可更新的字段' });
        }
        setClauses.push('updated_at = datetime(\'now\')');
        await db.run(
          `UPDATE user_ai_settings SET ${setClauses.join(', ')} WHERE user_id = ?`,
          [...params, userId]
        );
      }

      const row = await db.get(
        `SELECT api_base_url, api_key_encrypted, model, temperature, max_tokens, enabled
         FROM user_ai_settings
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );

      res.json({
        settings: {
          apiBaseUrl: row?.api_base_url || DEFAULTS.apiBaseUrl,
          apiKey: row?.api_key_encrypted ? '********' : '',
          model: row?.model || DEFAULTS.model,
          temperature: Number.isFinite(Number(row?.temperature)) ? Number(row.temperature) : DEFAULTS.temperature,
          maxTokens: Number.isFinite(Number(row?.max_tokens)) ? Number(row.max_tokens) : DEFAULTS.maxTokens,
          enabled: Boolean(row?.enabled)
        }
      });
    } catch (err) { return next(err); }
  });

  router.delete('/ai/settings', async (req, res, next) => {
    try {
      const userId = req.user.id;
      await db.run(
        `UPDATE user_ai_settings
         SET enabled = 0, deleted_at = datetime('now'), updated_at = datetime('now')
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
      );
      res.status(204).send();
    } catch (err) { return next(err); }
  });

  return router;
};
