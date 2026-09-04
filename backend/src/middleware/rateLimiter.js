/**
 * In-memory per-user rate limiter for monitoring chunk uploads.
 * Enforces a minimum interval between requests per authenticated user.
 * No external dependencies — uses a simple Map with automatic cleanup.
 */

const CHUNK_INTERVAL_MS = 3000; // 1 chunk every 3 seconds per user
const CLEANUP_INTERVAL_MS = 60000; // Clean stale entries every 60 seconds

const userTimestamps = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_EMAIL_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;
const REGISTRATION_IP_LIMIT = 5;
const loginAttemptsByEmail = new Map();
const loginAttemptsByIp = new Map();
const registrationAttemptsByIp = new Map();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getEmail(req) {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

function isRateLimited(store, key, limit, now) {
  const timestamps = (store.get(key) || []).filter(timestamp => now - timestamp < LOGIN_WINDOW_MS);

  if (timestamps.length >= limit) {
    store.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return false;
}

// Periodic cleanup of stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [userId, lastTime] of userTimestamps.entries()) {
    if (now - lastTime > CHUNK_INTERVAL_MS * 10) {
      userTimestamps.delete(userId);
    }
  }

  for (const store of [loginAttemptsByEmail, loginAttemptsByIp, registrationAttemptsByIp]) {
    for (const [key, timestamps] of store.entries()) {
      const recentTimestamps = timestamps.filter(timestamp => now - timestamp < LOGIN_WINDOW_MS);
      if (recentTimestamps.length === 0) {
        store.delete(key);
      } else {
        store.set(key, recentTimestamps);
      }
    }
  }
}, CLEANUP_INTERVAL_MS).unref(); // .unref() so this timer doesn't block process exit

export function loginRateLimiter(req, res, next) {
  const now = Date.now();
  const email = getEmail(req);
  const ip = getClientIp(req);

  if (email && isRateLimited(loginAttemptsByEmail, email, LOGIN_EMAIL_LIMIT, now)) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      error: 'Rate Limit Exceeded'
    });
  }

  if (isRateLimited(loginAttemptsByIp, ip, LOGIN_IP_LIMIT, now)) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      error: 'Rate Limit Exceeded'
    });
  }

  next();
}

export function registrationRateLimiter(req, res, next) {
  if (isRateLimited(registrationAttemptsByIp, getClientIp(req), REGISTRATION_IP_LIMIT, Date.now())) {
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again later.',
      error: 'Rate Limit Exceeded'
    });
  }

  next();
}

/**
 * Express middleware that rate-limits monitoring chunk uploads.
 * Requires req.userId to be set by the auth middleware upstream.
 */
export function monitoringRateLimiter(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for rate limiting.',
      error: 'Unauthorized'
    });
  }

  const now = Date.now();
  const lastRequest = userTimestamps.get(userId);

  if (lastRequest && (now - lastRequest) < CHUNK_INTERVAL_MS) {
    const retryAfterMs = CHUNK_INTERVAL_MS - (now - lastRequest);
    console.log(`[MONITORING RATE LIMITER] User ${userId} rate limited. Retry after ${retryAfterMs}ms`);

    return res.status(429).json({
      success: false,
      message: 'Too many requests. Maximum 1 audio chunk every 3 seconds.',
      retryAfterMs,
      error: 'Rate Limit Exceeded'
    });
  }

  userTimestamps.set(userId, now);
  next();
}

export default monitoringRateLimiter;
