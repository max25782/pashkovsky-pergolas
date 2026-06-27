/**
 * Site-level rate limiting via Upstash Redis.
 *
 * Requires env vars: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * (same vars shared with the CRM app via Vercel project settings).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

function buildRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = buildRedis()

function makeLimiter(
  maxRequests: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
  prefix: string,
): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix: `rl:site:${prefix}`,
  })
}

// Heavy PDF generation — max 5 PDFs per IP per hour
export const pdfLimiter = makeLimiter(5, '1 h', 'pdf')

// Gallery S3 listing — max 60 requests per IP per minute
export const galleryLimiter = makeLimiter(60, '1 m', 'gallery')

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    // Fail open in dev — warn so it's visible in logs
    console.warn('[rate-limit] Upstash not configured, skipping rate limit check')
    return { allowed: true }
  }
  const { success, reset } = await limiter.limit(identifier)
  return {
    allowed: success,
    retryAfter: success ? undefined : Math.ceil((reset - Date.now()) / 1000),
  }
}
