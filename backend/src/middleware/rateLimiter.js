/**
 * In-memory per-user rate limiter for monitoring chunk uploads.
 * Enforces a minimum interval between requests per authenticated user.
 * No external dependencies — uses a simple Map with automatic cleanup.
 */

const CHUNK_INTERVAL_MS = 3000; // 1 chunk every 3 seconds per user
const CLEANUP_INTERVAL_MS = 60000; // Clean stale entries every 60 seconds

const userTimestamps = new Map();

// Periodic cleanup of stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [userId, lastTime] of userTimestamps.entries()) {
    if (now - lastTime > CHUNK_INTERVAL_MS * 10) {
      userTimestamps.delete(userId);
    }
  }
}, CLEANUP_INTERVAL_MS).unref(); // .unref() so this timer doesn't block process exit

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
