'use strict';

const dns = require('dns');
const net = require('net');

const DEFAULT_ALLOWLIST_ENV = 'AI_BASE_URL_ALLOWLIST';

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
}

function parseAllowlist(value) {
  const raw = value ? String(value) : '';
  return raw
    .split(',')
    .map(s => normalizeHostname(s))
    .filter(Boolean);
}

function isHostnameAllowed(hostname, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  return allowlist.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) + n;
  }
  return out >>> 0;
}

function inCidrIPv4(ipInt, base, maskBits) {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  const mask = maskBits === 0 ? 0 : ((~0 << (32 - maskBits)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

function isBlockedIPv4(ip) {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return true;

  const blockedCidrs = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];

  return blockedCidrs.some(([base, bits]) => inCidrIPv4(ipInt, base, bits));
}

function parseIPv6ToParts(ip) {
  const raw = String(ip || '').trim().toLowerCase();
  if (!raw) return null;

  let ipv6 = raw;
  let v4Hextets = [];

  if (ipv6.includes('.')) {
    const lastColon = ipv6.lastIndexOf(':');
    if (lastColon < 0) return null;
    const v4 = ipv6.slice(lastColon + 1);
    const v4Int = ipv4ToInt(v4);
    if (v4Int === null) return null;
    v4Hextets = [((v4Int >>> 16) & 0xffff).toString(16), (v4Int & 0xffff).toString(16)];
    ipv6 = ipv6.slice(0, lastColon);
  }

  let headParts = [];
  let tailParts = [];

  if (ipv6.includes('::')) {
    const split = ipv6.split('::');
    if (split.length !== 2) return null;
    headParts = split[0] ? split[0].split(':').filter(Boolean) : [];
    tailParts = split[1] ? split[1].split(':').filter(Boolean) : [];
  } else {
    headParts = ipv6 ? ipv6.split(':').filter(Boolean) : [];
  }

  tailParts = tailParts.concat(v4Hextets);
  const missing = 8 - (headParts.length + tailParts.length);
  if (missing < 0) return null;

  const parts = headParts.concat(Array(missing).fill('0'), tailParts);
  if (parts.length !== 8) return null;

  const normalized = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
    normalized.push(p);
  }

  return normalized;
}

function isBlockedIPv6(ip) {
  const parts = parseIPv6ToParts(ip);
  if (!parts) return true;

  const hextet0 = parseInt(parts[0], 16);
  if (!Number.isFinite(hextet0)) return true;

  const allZero = parts.every(p => p === '0');
  if (allZero) return true;

  const loopback = parts.slice(0, 7).every(p => p === '0') && parts[7] === '1';
  if (loopback) return true;

  if (hextet0 >= 0xfc00 && hextet0 <= 0xfdff) return true;

  if (hextet0 >= 0xfe80 && hextet0 <= 0xfebf) return true;

  if (hextet0 >= 0xff00 && hextet0 <= 0xffff) return true;

  return false;
}

function isBlockedIp(ip) {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) {
    if (String(ip).includes('.')) {
      const v4 = String(ip).split(':').pop();
      if (v4 && net.isIP(v4) === 4) return isBlockedIPv4(v4);
    }
    return isBlockedIPv6(ip);
  }
  return true;
}

function normalizeAiBaseUrl(urlOrString) {
  const u = urlOrString instanceof URL ? urlOrString : new URL(String(urlOrString));
  let path = u.pathname || '';
  if (path === '/') path = '';
  path = path.replace(/\/+$/, '');
  return `${u.origin}${path}`;
}

async function isValidAiBaseUrl(input, options = {}) {
  const raw = input ? String(input).trim() : '';
  if (!raw) return { ok: false, reason: '缺少 API Base URL' };

  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: '无效的 URL' };
  }

  if (u.username || u.password) {
    return { ok: false, reason: 'URL 不允许包含用户名/密码' };
  }

  if (u.protocol !== 'https:') {
    return { ok: false, reason: '仅允许 HTTPS' };
  }

  if (u.search || u.hash) {
    return { ok: false, reason: 'URL 不允许包含 query/hash' };
  }

  const hostname = normalizeHostname(u.hostname);
  if (!hostname) return { ok: false, reason: '无效的 hostname' };

  const allowlist = Array.isArray(options.allowlist)
    ? options.allowlist.map(normalizeHostname).filter(Boolean)
    : parseAllowlist(process.env[DEFAULT_ALLOWLIST_ENV]);

  if (!isHostnameAllowed(hostname, allowlist)) {
    return { ok: false, reason: 'hostname 不在允许列表中' };
  }

  const disallowedHosts = new Set(['localhost', 'localhost.localdomain']);
  if (disallowedHosts.has(hostname)) {
    return { ok: false, reason: '禁止使用 localhost' };
  }

  const ipKind = net.isIP(hostname);
  if (ipKind === 4 || ipKind === 6) {
    if (isBlockedIp(hostname)) return { ok: false, reason: '禁止使用内网/保留地址' };
    return { ok: true, normalizedUrl: normalizeAiBaseUrl(u) };
  }

  let resolved;
  try {
    resolved = await dns.promises.lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: 'hostname 无法解析' };
  }

  if (!Array.isArray(resolved) || resolved.length === 0) {
    return { ok: false, reason: 'hostname 无法解析到 IP' };
  }

  for (const r of resolved) {
    if (r && r.address && isBlockedIp(r.address)) {
      return { ok: false, reason: 'hostname 解析到内网/保留 IP' };
    }
  }

  return { ok: true, normalizedUrl: normalizeAiBaseUrl(u) };
}

async function assertValidAiBaseUrl(input, options = {}) {
  const result = await isValidAiBaseUrl(input, options);
  if (!result.ok) {
    const err = new Error(result.reason || '无效的 API Base URL');
    err.status = 400;
    err.code = 'INVALID_AI_BASE_URL';
    throw err;
  }
  return result.normalizedUrl;
}

module.exports = {
  isValidAiBaseUrl,
  assertValidAiBaseUrl,
  normalizeAiBaseUrl
};
