import { redis } from '@/lib/session/redis-client'
import { NextRequest, NextResponse } from 'next/server'

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get('x-debug-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.DEBUG_TOKEN || process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Test Redis connection
    const testKey = `test:connection:${Date.now()}`
    
    // Write
    await redis.set(testKey, 'Hello from Vercel!', { ex: 10 })
    
    // Read
    const value = await redis.get(testKey)
    
    // Delete
    await redis.del(testKey)
    
    return NextResponse.json({
      success: true,
      message: 'Redis is working!',
      test: {
        wrote: 'Hello from Vercel!',
        read: value,
        match: value === 'Hello from Vercel!',
      },
      env: {
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      env: {
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      },
    }, { status: 500 })
  }
}




