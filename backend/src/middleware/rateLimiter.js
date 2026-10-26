/**
 * Distributed rate limiter middleware backed by Redis.
 * Shares rate limit state across multiple server instances on AWS,
 * with automatic in-memory fallback for local development.
 */

import { checkIntervalRateLimit, checkCounterRateLimit } from '../config/redis.js';

const CHUNK_INTERVAL_MS = 3000; // 1 chunk every 3 seconds per user
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_EMAIL_LIMIT = process.env.NODE_ENV === 'development' ? 100 : 5;
const LOGIN_IP_LIMIT = process.env.NODE_ENV === 'development' ? 200 : 20;
const REGISTRATION_IP_LIMIT = process.env.NODE_ENV === 'development' ? 50 : 5;
const CALL_CONTACT_WINDOW_SECONDS = 60 * 60; // 1 hour
const CALL_CONTACT_LIMIT = process.env.NODE_ENV === 'development' ? 50 : 5; // 5 calls/hour per user

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getEmail(req) {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

export async function loginRateLimiter(req, res, next) {
  const email = getEmail(req);
  const ip = getClientIp(req);

  try {
    if (email) {
      const emailCheck = await checkCounterRateLimit(
        `ratelimit:login:email:${email}`,
        LOGIN_EMAIL_LIMIT,
        LOGIN_WINDOW_SECONDS
      );

      if (!emailCheck.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Too many login attempts. Please try again later.',
          error: 'Rate Limit Exceeded'
        });
      }
    }

    const ipCheck = await checkCounterRateLimit(
      `ratelimit:login:ip:${ip}`,
      LOGIN_IP_LIMIT,
      LOGIN_WINDOW_SECONDS
    );

    if (!ipCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        error: 'Rate Limit Exceeded'
      });
    }

    next();
  } catch (err) {
    console.warn('[LOGIN RATE LIMITER] Error checking rate limit:', err.message);
    next();
  }
}

export async function registrationRateLimiter(req, res, next) {
  const ip = getClientIp(req);

  try {
    const ipCheck = await checkCounterRateLimit(
      `ratelimit:register:ip:${ip}`,
      REGISTRATION_IP_LIMIT,
      LOGIN_WINDOW_SECONDS
    );

    if (!ipCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many registration attempts. Please try again later.',
        error: 'Rate Limit Exceeded'
      });
    }

    next();
  } catch (err) {
    console.warn('[REGISTRATION RATE LIMITER] Error checking rate limit:', err.message);
    next();
  }
}

/**
 * Express middleware that rate-limits monitoring chunk uploads.
 * Enforces minimum 3-second interval per authenticated user across all server replicas.
 */
export async function monitoringRateLimiter(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for rate limiting.',
      error: 'Unauthorized'
    });
  }

  try {
    const { allowed, retryAfterMs } = await checkIntervalRateLimit(
      `ratelimit:chunk:${userId}`,
      CHUNK_INTERVAL_MS
    );

    if (!allowed) {
      console.log(`[MONITORING RATE LIMITER] User ${userId} rate limited. Retry after ${retryAfterMs}ms`);
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Maximum 1 audio chunk every 3 seconds.',
        retryAfterMs,
        error: 'Rate Limit Exceeded'
      });
    }

    next();
  } catch (err) {
    console.warn('[MONITORING RATE LIMITER] Rate limiter error:', err.message);
    next();
  }
}

/**
 * Express middleware that rate-limits voice calls placed via the call-contact endpoint.
 * Enforces a maximum of 5 calls per authenticated user per hour to prevent
 * harassment and unintended Twilio billing abuse.
 */
export async function callContactRateLimiter(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Unauthorized'
    });
  }

  try {
    const check = await checkCounterRateLimit(
      `ratelimit:call-contact:${userId}`,
      CALL_CONTACT_LIMIT,
      CALL_CONTACT_WINDOW_SECONDS
    );

    if (!check.allowed) {
      console.warn(`[CALL RATE LIMITER] User ${userId} exceeded call-contact rate limit.`);
      return res.status(429).json({
        success: false,
        message: 'Too many emergency calls. Maximum 5 calls per hour.',
        error: 'Rate Limit Exceeded'
      });
    }

    next();
  } catch (err) {
    console.warn('[CALL RATE LIMITER] Rate limiter error:', err.message);
    next();
  }
}

export default monitoringRateLimiter;
