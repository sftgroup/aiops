/**
 * ttl-store.cjs — In-memory store with automatic TTL cleanup
 *
 * Provides a Map-like interface where each entry has a configurable
 * expiration time. A background interval sweeps expired entries
 * periodically to prevent unbounded memory growth.
 *
 * Usage:
 *   const store = new TTLStore({ ttl: 600_000, sweepInterval: 60_000 });
 *   store.set('key', { data: 123 });
 *   const val = store.get('key');   // null if expired
 *   store.delete('key');
 *   store.size;                     // live entry count
 *   store.stop();                   // stop the sweep timer
 */
class TTLStore {
  /**
   * @param {object} opts
   * @param {number} [opts.ttl]         Default TTL in ms (default 600_000 = 10 min)
   * @param {number} [opts.sweepInterval]  How often to scan for expired entries (default 60_000 = 1 min)
   */
  constructor(opts = {}) {
    this._ttl = opts.ttl || 600_000;         // default 10 minutes
    this._sweepInterval = opts.sweepInterval || 60_000; // default 1 minute
    /** @type {Map<string, {expiresAt: number, value: *}>} */
    this._map = new Map();
    this._timer = null;

    if (this._sweepInterval > 0) {
      this._timer = setInterval(() => this._sweep(), this._sweepInterval);
      this._timer.unref(); // don't prevent process exit
    }
  }

  /**
   * Set a value with optional per-key TTL override.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlMs]  Per-key TTL in ms; falls back to instance default
   */
  set(key, value, ttlMs) {
    const ttl = typeof ttlMs === 'number' ? ttlMs : this._ttl;
    this._map.set(key, { expiresAt: Date.now() + ttl, value });
  }

  /**
   * Get a value. Returns null if the key doesn't exist or has expired.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this._map.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Delete a key.
   * @param {string} key
   * @returns {boolean} true if the key existed
   */
  delete(key) {
    return this._map.delete(key);
  }

  /** Check if a key exists (and is not expired). */
  has(key) {
    return this.get(key) !== null;
  }

  /** Number of live entries. */
  get size() {
    this._sweep(); // ensure accuracy
    return this._map.size;
  }

  /** Clear all entries. */
  clear() {
    this._map.clear();
  }

  /**
   * Iterate over live entries.
   * @returns {Iterator<[string, *]>}
   */
  *entries() {
    this._sweep();
    for (const [key, entry] of this._map) {
      yield [key, entry.value];
    }
  }

  /** Stop the background sweep timer. Useful for tests or graceful shutdown. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Internal: remove all expired entries. */
  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._map) {
      if (now >= entry.expiresAt) {
        this._map.delete(key);
      }
    }
  }
}

module.exports = { TTLStore };
