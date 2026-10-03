import Redis from 'ioredis';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REDIS CLIENT & DISTRIBUTED STATE STORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Provides shared distributed state across multi-server deployments on AWS:
 * - Distributed rate limiting (chunk uploads, auth attempts)
 * - Distributed 5-minute duplicate-incident cooldown guard
 *
 * In local development without Redis, automatically falls back to an
 * in-memory store so developers can run the app without a Redis daemon.
 */

let redisClient = null;
let isConnected = false;
let isRedisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

// In-memory fallback stores for local development without Redis
const memoryStore = new Map();
const memoryTimeouts = new Map();

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  const options = {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 3000,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('⚠️ [REDIS] Max reconnect attempts reached. Using in-memory fallback.');
        return null; // Stop reconnecting
      }
      return Math.min(times * 500, 2000);
    }
  };

  try {
    if (redisUrl) {
      return new Redis(redisUrl, options);
    } else if (process.env.REDIS_HOST) {
      return new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        ...options
      });
    }
    return null;
  } catch (err) {
    console.warn('⚠️ [REDIS] Could not initialize Redis client:', err.message);
    return null;
  }
}

if (isRedisConfigured) {
  redisClient = createRedisClient();

  if (redisClient) {
    redisClient.on('connect', () => {
      isConnected = true;
      console.log('💚 [REDIS] Connected to Redis cluster successfully.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      console.log('💚 [REDIS] Distributed rate limiting & incident cooldown active.');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      console.warn('⚠️ [REDIS] Connection error:', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  }
} else {
  console.log('ℹ️ [REDIS] REDIS_URL not configured. Running in IN-MEMORY fallback mode (local dev).');
}

/**
 * Returns true if Redis is online and ready for distributed operations.
 */
export function isRedisAvailable() {
  return Boolean(redisClient && isConnected);
}

/**
 * Gets the raw ioredis client instance.
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Distributed GET with in-memory fallback.
 */
export async function get(key) {
  if (isRedisAvailable()) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      console.warn(`[REDIS] GET failed for ${key}, using memory:`, err.message);
    }
  }
  return memoryStore.get(key) || null;
}

/**
 * Distributed SET with support for 'EX' (seconds) or 'PX' (milliseconds) and 'NX'.
 */
export async function set(key, value, mode, duration, flag) {
  if (isRedisAvailable()) {
    try {
      const args = [key, value];
      if (mode && duration !== undefined) args.push(mode, duration);
      if (flag) args.push(flag);
      return await redisClient.set(...args);
    } catch (err) {
      console.warn(`[REDIS] SET failed for ${key}, using memory:`, err.message);
    }
  }

  // In-memory fallback
  if (flag === 'NX' && memoryStore.has(key)) {
    return null;
  }

  memoryStore.set(key, value);

  // Handle TTL
  if (memoryTimeouts.has(key)) {
    clearTimeout(memoryTimeouts.get(key));
    memoryTimeouts.delete(key);
  }

  let ttlMs = 0;
  if (mode === 'EX' && duration) ttlMs = duration * 1000;
  else if (mode === 'PX' && duration) ttlMs = duration;

  if (ttlMs > 0) {
    const timer = setTimeout(() => {
      memoryStore.delete(key);
      memoryTimeouts.delete(key);
    }, ttlMs);
    timer.unref();
    memoryTimeouts.set(key, timer);
  }

  return 'OK';
}

/**
 * Distributed DEL.
 */
export async function del(key) {
  if (isRedisAvailable()) {
    try {
      return await redisClient.del(key);
    } catch (err) {
      console.warn(`[REDIS] DEL failed for ${key}:`, err.message);
    }
  }

  if (memoryTimeouts.has(key)) {
    clearTimeout(memoryTimeouts.get(key));
    memoryTimeouts.delete(key);
  }
  const existed = memoryStore.has(key);
  memoryStore.delete(key);
  return existed ? 1 : 0;
}

/**
 * Atomic minimum-interval rate limit check (e.g. 1 chunk every 3 seconds).
 * Uses Redis SET key val PX intervalMs NX.
 *
 * @param {string} key - Rate limit key (e.g. `ratelimit:chunk:${userId}`)
 * @param {number} intervalMs - Minimum allowed interval between requests in ms
 * @returns {Promise<{ allowed: boolean, retryAfterMs: number }>}
 */
export async function checkIntervalRateLimit(key, intervalMs) {
  if (isRedisAvailable()) {
    try {
      const now = Date.now();
      const res = await redisClient.set(key, String(now), 'PX', intervalMs, 'NX');
      if (res === 'OK') {
        return { allowed: true, retryAfterMs: 0 };
      }
      const ttl = await redisClient.pttl(key);
      return { allowed: false, retryAfterMs: Math.max(ttl, 0) };
    } catch (err) {
      console.warn(`[REDIS] checkIntervalRateLimit failed, falling back to memory:`, err.message);
    }
  }

  // In-memory fallback
  const now = Date.now();
  const lastTime = memoryStore.get(key);
  if (lastTime && (now - lastTime) < intervalMs) {
    const retryAfterMs = intervalMs - (now - lastTime);
    return { allowed: false, retryAfterMs };
  }

  memoryStore.set(key, now);
  if (memoryTimeouts.has(key)) {
    clearTimeout(memoryTimeouts.get(key));
  }
  const timer = setTimeout(() => {
    memoryStore.delete(key);
    memoryTimeouts.delete(key);
  }, intervalMs * 2);
  timer.unref();
  memoryTimeouts.set(key, timer);

  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Atomic counter rate limit check (e.g. 5 attempts per 15 minutes).
 * Uses Redis INCR + EXPIRE.
 *
 * @param {string} key - Rate limit key
 * @param {number} limit - Maximum requests allowed in the window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterSeconds: number }>}
 */
export async function checkCounterRateLimit(key, limit, windowSeconds) {
  if (isRedisAvailable()) {
    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      const ttl = await redisClient.ttl(key);
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
      };
    } catch (err) {
      console.warn(`[REDIS] checkCounterRateLimit failed, falling back to memory:`, err.message);
    }
  }

  // In-memory fallback
  const now = Date.now();
  let timestamps = (memoryStore.get(key) || []).filter(t => (now - t) < (windowSeconds * 1000));
  if (timestamps.length >= limit) {
    memoryStore.set(key, timestamps);
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.ceil(((oldest + (windowSeconds * 1000)) - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  timestamps.push(now);
  memoryStore.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, retryAfterSeconds: windowSeconds };
}

export default {
  isRedisAvailable,
  getRedisClient,
  get,
  set,
  del,
  checkIntervalRateLimit,
  checkCounterRateLimit
};
