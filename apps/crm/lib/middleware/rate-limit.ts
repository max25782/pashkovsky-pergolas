/**
 * Rate Limiting via Upstash Redis
 *
 * Replaces the previous in-memory Map which reset on every serverless cold start
 * (making it completely ineffective on Vercel). Upstash Redis persists across invocations.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function buildRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = buildRedis()

function makeLimiter(maxRequests: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix: `rl:${prefix}`,
  })
}

// Auth limiters — strict
const loginLimiter     = makeLimiter(5,  '15 m', 'login')
const registerLimiter  = makeLimiter(3,  '1 h',  'register')
const pwResetLimiter   = makeLimiter(3,  '1 h',  'pwreset')
const emailVerifyLimiter = makeLimiter(5, '1 h', 'emailverify')

// AI limiters — per company (key passed by caller)
export const aiImproveLimiter   = makeLimiter(30, '1 d', 'ai:improve')
export const aiReportLimiter    = makeLimiter(3,  '1 d', 'ai:report')
export const aiDirectorLimiter  = makeLimiter(50, '1 d', 'ai:director')
export const aiScoreLimiter     = makeLimiter(50, '1 d', 'ai:score')

// Site public limiters — per IP
export const pdfLimiter         = makeLimiter(5,  '1 h', 'site:pdf')
export const galleryLimiter     = makeLimiter(60, '1 m', 'site:gallery')

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

/**
 * Check a named rate limit bucket.
 * Fails open (allows the request) when Redis is not configured or unreachable,
 * so a Redis outage or connection blip never blocks core functionality.
 */
export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 }
  }
  try {
    const { success, remaining, reset } = await limiter.limit(identifier)
    return {
      allowed: success,
      remaining,
      resetAt: reset,
      retryAfter: success ? undefined : Math.ceil((reset - Date.now()) / 1000),
    }
  } catch (err) {
    console.error('[RateLimit] Redis error — failing open:', err instanceof Error ? err.message : err)
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 }
  }
}

// ---------------------------------------------------------------------------
// Auth rate limiter helpers — called as await rateLimiters.auth.login(req)
// ---------------------------------------------------------------------------

export const rateLimiters = {
  auth: {
    login:         (req: Request) => checkLimit(loginLimiter,       getClientIp(req)),
    register:      (req: Request) => checkLimit(registerLimiter,    getClientIp(req)),
    passwordReset: (req: Request) => checkLimit(pwResetLimiter,     getClientIp(req)),
    verifyEmail:   (req: Request) => checkLimit(emailVerifyLimiter, getClientIp(req)),
  },
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  identifier?: string
}

/** Drop-in for auth routes that call checkRateLimit(req, options) */
export async function checkRateLimit(
  req: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const id = options.identifier ?? getClientIp(req)
  const windowSec = Math.round(options.windowMs / 1000)
  const window = `${windowSec} s` as Parameters<typeof Ratelimit.slidingWindow>[1]
  const limiter = makeLimiter(options.maxRequests, window, `custom:${options.maxRequests}:${windowSec}`)
  return checkLimit(limiter, id)
}

/** Alias of checkRateLimit — kept for backward compatibility with platform/tenant barrel */
export const rateLimit = checkRateLimit
