/**
 * Public-route rate limiter backed by Upstash Redis.
 *
 * Replaces the previous in-memory Map which silently resets on every
 * serverless cold start (completely ineffective on Vercel).
 *
 * Required env vars (shared with apps/crm):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

function buildRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Lazily built cache of Ratelimit instances keyed by config string
const limiterCache = new Map<string, Ratelimit>()

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = buildRedis()
  if (!redis) return null

  const key = `${config.maxRequests}:${config.windowMs}`
  if (!limiterCache.has(key)) {
    const windowSec = Math.round(config.windowMs / 1000)
    limiterCache.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSec} s`),
        prefix: `rl:public`,
      }),
    )
  }
  return limiterCache.get(key)!
}

/**
 * Check if identifier (e.g. `lead:<ip>`) is within the rate limit window.
 * Fails open when Upstash is not configured (dev without Redis).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> | RateLimitResult {
  const limiter = getLimiter(config)

  if (!limiter) {
    console.warn('[rate-limit] Upstash not configured — rate limit skipped')
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs }
  }

  return limiter.limit(identifier).then(({ success, remaining, reset }) => ({
    allowed: success,
    remaining,
    resetAt: reset,
  }))
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  // Try various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return 'unknown'
}

