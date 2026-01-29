'use strict';

class TtlCache {
  constructor(options = {}) {
    const maxItems = Number(options.maxItems);
    const defaultTtlMs = Number(options.defaultTtlMs);

    this._maxItems = Number.isFinite(maxItems) && maxItems > 0 ? Math.floor(maxItems) : 500;
    this._defaultTtlMs = Number.isFinite(defaultTtlMs) && defaultTtlMs > 0 ? Math.floor(defaultTtlMs) : 10_000;
    this._map = new Map();
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this._map.delete(key);
      return undefined;
    }

    // LRU-ish: refresh key order
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    const ttl = Number(ttlMs);
    const effectiveTtl = Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : this._defaultTtlMs;
    const expiresAt = Date.now() + effectiveTtl;

    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, { value, expiresAt });

    while (this._map.size > this._maxItems) {
      const oldestKey = this._map.keys().next().value;
      this._map.delete(oldestKey);
    }
  }

  delete(key) {
    this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }
}

module.exports = {
  TtlCache,
};

