import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit'
import { ApiError, ErrorCode } from '../common/errors/api-error.js'
import { env } from '../config/env.js'

/**
 * Rate limiting.
 *
 * Phase 3 defined the RATE_LIMITED error code but never enforced a limit. These
 * limiters activate it.
 *
 * STORAGE NOTE: the default in-memory store is correct for a single local
 * instance. A horizontally scaled deployment MUST supply a shared store
 * (Redis/Memcached) via the `store` option, otherwise each instance keeps its
 * own counters and the effective limit multiplies.
 */

/** Consistent 429 envelope matching the project's error contract. */
function rateLimitHandler(_req: unknown, res: any, _next: unknown, options: any): void {
  res.status(options?.statusCode ?? 429).json({
    success: false,
    error: {
      code: ErrorCode.RATE_LIMITED,
      message: 'Too many requests. Please try again later.',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals?.requestId ?? 'unknown',
    },
  })
}

/**
 * Key generator.
 *
 * Uses `ipKeyGenerator` from express-rate-limit, which normalizes IPv6 into a
 * /64 subnet. Importantly it does NOT trust `X-Forwarded-For` unless the app is
 * explicitly configured to trust a known proxy (`TRUST_PROXY_HOPS`).
 */
function keyGenerator(req: any): string {
  return ipKeyGenerator(req.ip ?? 'unknown')
}

/** Strict limiter for credential endpoints to blunt password guessing. */
export const loginRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  // Successful logins must not consume the budget.
  skipSuccessfulRequests: true,
})

/** Baseline limiter applied across the API surface. */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
})

/** Builds a limiter with an explicit limit, used by deterministic tests. */
export function createRateLimiter(limit: number, windowMs = 15 * 60 * 1000): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimitHandler,
  })
}

export { rateLimitHandler, keyGenerator, ApiError }