/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter (can be replaced with Redis for production)
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number // Time window in milliseconds
  identifier?: string // Custom identifier (default: IP address)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number // Seconds until retry is allowed
}

/**
 * Check rate limit
 * @param req - Next.js request
 * @param options - Rate limit options
 * @returns Rate limit result
 */
export function checkRateLimit(
  req: Request,
  options: RateLimitOptions
): RateLimitResult {
  const { maxRequests, windowMs, identifier } = options

  // Get identifier (IP address or custom)
  const id = identifier || getClientIp(req)
  const key = `${id}:${windowMs}`

  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    }
    rateLimitStore.set(key, newEntry)

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: newEntry.resetAt,
    }
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  // Check various headers (for proxies/load balancers)
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback (won't work in serverless, but good for dev)
  return 'unknown'
}

/**
 * Rate limit middleware for API routes
 */
export function rateLimit(options: RateLimitOptions) {
  return (req: Request): RateLimitResult => {
    return checkRateLimit(req, options)
  }
}

/**
 * Predefined rate limiters
 */
export const rateLimiters = {
  // Auth endpoints - stricter limits
  auth: {
    login: rateLimit({ maxRequests: 5, windowMs: 15 * 60 * 1000 }), // 5 attempts per 15 minutes
    register: rateLimit({ maxRequests: 3, windowMs: 60 * 60 * 1000 }), // 3 per hour
    passwordReset: rateLimit({ maxRequests: 3, windowMs: 60 * 60 * 1000 }), // 3 per hour
    verifyEmail: rateLimit({ maxRequests: 5, windowMs: 60 * 60 * 1000 }), // 5 per hour
  },

  // General API - more lenient
  api: {
    default: rateLimit({ maxRequests: 100, windowMs: 60 * 1000 }), // 100 per minute
    strict: rateLimit({ maxRequests: 20, windowMs: 60 * 1000 }), // 20 per minute
  },
}



