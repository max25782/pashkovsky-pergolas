/**
 * Redis Client for Server-Side Sessions
 * 
 * For development: Use Upstash Redis (free tier)
 * For production: Use Redis Cloud or self-hosted Redis
 */

import { Redis } from '@upstash/redis'

// Initialize Redis client
// Get credentials from: https://console.upstash.com/
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// Session configuration
const SESSION_PREFIX = 'superadmin:session:'
const SESSION_TTL = 60 * 60 * 24 // 24 hours in seconds

export interface SuperAdminSession {
  user_id: string
  email: string
  role: 'superadmin'
  phone: string
  created_at: string
  last_activity: string
}

/**
 * Create a new SuperAdmin session
 */
export async function createSession(data: Omit<SuperAdminSession, 'created_at' | 'last_activity'>): Promise<string> {
  // Generate secure random session ID
  const sessionId = crypto.randomUUID()
  
  const session: SuperAdminSession = {
    ...data,
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
  }
  
  // Store in Redis with TTL
  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    SESSION_TTL,
    JSON.stringify(session)
  )
  
  console.log('[Session] Created:', { sessionId, email: session.email })
  
  return sessionId
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<SuperAdminSession | null> {
  const data = await redis.get<string>(`${SESSION_PREFIX}${sessionId}`)
  
  if (!data) {
    return null
  }
  
  const session = typeof data === 'string' ? JSON.parse(data) : data
  
  // Update last activity
  session.last_activity = new Date().toISOString()
  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    SESSION_TTL,
    JSON.stringify(session)
  )
  
  return session as SuperAdminSession
}

/**
 * Delete session (logout)
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`)
  console.log('[Session] Deleted:', sessionId)
}

/**
 * Validate session exists and is active
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId)
  return session !== null && session.role === 'superadmin'
}

/**
 * Get all active sessions for a user (optional, for "logout all devices")
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  // Note: This requires scanning Redis keys, which is slow
  // Better to maintain a separate index: user:{userId}:sessions
  const keys = await redis.keys(`${SESSION_PREFIX}*`)
  const sessions: string[] = []
  
  for (const key of keys) {
    const data = await redis.get<string>(key)
    if (data) {
      const session = typeof data === 'string' ? JSON.parse(data) : data
      if (session.user_id === userId) {
        sessions.push(key.replace(SESSION_PREFIX, ''))
      }
    }
  }
  
  return sessions
}

