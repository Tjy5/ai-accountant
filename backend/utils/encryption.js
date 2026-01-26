'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AAD = Buffer.from('ai-accountant-encryption-v1', 'utf8');
const VERSION = 'v1';
const KEY_ENV = 'ENCRYPTION_KEY';

let cachedKey = null;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env[KEY_ENV];
  const source = raw ? String(raw).trim() : '';
  if (!source) {
    const err = new Error(`${KEY_ENV} is not set`);
    err.status = 500;
    throw err;
  }

  let key;
  if (source.startsWith('base64:')) {
    key = Buffer.from(source.slice('base64:'.length), 'base64');
  } else if (source.startsWith('hex:')) {
    key = Buffer.from(source.slice('hex:'.length), 'hex');
  } else if (/^[0-9a-fA-F]{64}$/.test(source)) {
    key = Buffer.from(source, 'hex');
  } else {
    const asB64 = Buffer.from(source, 'base64');
    if (asB64.length === KEY_BYTES) {
      key = asB64;
    } else {
      if (source.length < 16) {
        const err = new Error(`${KEY_ENV} is too short (min 16 chars recommended)`);
        err.status = 500;
        throw err;
      }
      key = crypto.createHash('sha256').update(source, 'utf8').digest();
    }
  }

  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    const err = new Error(`${KEY_ENV} must be 32 bytes (suggest: base64:... or hex:...)`);
    err.status = 500;
    throw err;
  }

  cachedKey = key;
  return cachedKey;
}

function encryptApiKey(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.trim().length === 0) {
    const err = new Error('apiKey is required');
    err.status = 400;
    throw err;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptApiKey(payload) {
  if (typeof payload !== 'string' || payload.trim().length === 0) {
    const err = new Error('Encrypted apiKey is missing');
    err.status = 400;
    throw err;
  }

  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    const err = new Error('Unsupported encrypted apiKey format');
    err.status = 400;
    throw err;
  }

  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}

module.exports = {
  encryptApiKey,
  decryptApiKey
};
