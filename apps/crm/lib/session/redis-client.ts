/**
 * Redis Client for Server-Side Sessions
 *
 * Production: Upstash REST only.
 *
 * Development (default): in-memory sessions only — avoids dead/invalid Upstash URLs (ENOTFOUND),
 * and survives HMR better via globalThis (module reload no longer wipes the Map).
 * To use real Upstash locally: USE_UPSTASH_IN_DEV=true in .env.local
 */

import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

const SESSION_PREFIX = 'superadmin:session:'
const SESSION_TTL = 60 * 60 * 24

const GLOBAL_MEM_KEY = '__alumincrmSuperadminSessions__' as const

export interface SuperAdminSession {
  user_id: string
  email: string
  role: 'superadmin'
  phone: string
  created_at: string
  last_activity: string
}

function hasUpstashConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  return Boolean(url && token)
}

/** Opt in to Upstash during `next dev` (default is memory-only). */
function useUpstashInDevelopment(): boolean {
  const v = process.env.USE_UPSTASH_IN_DEV?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

let devRedisUnavailable = false

function useDevMemorySessions(): boolean {
  if (process.env.NODE_ENV !== 'development') return false
  if (!useUpstashInDevelopment()) return true
  return !hasUpstashConfig() || devRedisUnavailable
}

function markDevRedisFallback(reason: unknown): void {
  if (process.env.NODE_ENV !== 'development') return
  devRedisUnavailable = true
  console.warn(
    '[redis-client] Upstash failed in dev (USE_UPSTASH_IN_DEV=true). Falling back to in-memory. Fix URL/token or set USE_UPSTASH_IN_DEV=0.',
    reason,
  )
}

interface MemoryEntry {
  value: string
  expiresAt: number
}

function getMemoryStore(): Map<string, MemoryEntry> {
  const g = globalThis as unknown as Record<string, Map<string, MemoryEntry>>
  if (!g[GLOBAL_MEM_KEY]) {
    g[GLOBAL_MEM_KEY] = new Map()
  }
  return g[GLOBAL_MEM_KEY]
}

let loggedDevMemoryHint = false

function logDevMemoryOnce(): void {
  if (loggedDevMemoryHint) return
  loggedDevMemoryHint = true
  console.warn(
    '[redis-client] SuperAdmin sessions: in-memory (next dev default). Set USE_UPSTASH_IN_DEV=true to use Upstash locally.',
  )
}

async function memorySetex(key: string, ttlSeconds: number, value: string): Promise<void> {
  getMemoryStore().set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

async function memoryGet(key: string): Promise<string | null> {
  const memorySessions = getMemoryStore()
  const entry = memorySessions.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memorySessions.delete(key)
    return null
  }
  return entry.value
}

async function memoryDel(key: string): Promise<void> {
  getMemoryStore().delete(key)
}

export async function createSession(data: Omit<SuperAdminSession, 'created_at' | 'last_activity'>): Promise<string> {
  const sessionId = crypto.randomUUID()

  const session: SuperAdminSession = {
    ...data,
    created_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
  }

  const key = `${SESSION_PREFIX}${sessionId}`
  const payload = JSON.stringify(session)

  if (useDevMemorySessions()) {
    logDevMemoryOnce()
    await memorySetex(key, SESSION_TTL, payload)
    return sessionId
  }

  try {
    await redis.setex(key, SESSION_TTL, payload)
    return sessionId
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      markDevRedisFallback(err)
      await memorySetex(key, SESSION_TTL, payload)
      return sessionId
    }
    throw err
  }
}

export async function getSession(sessionId: string): Promise<SuperAdminSession | null> {
  const key = `${SESSION_PREFIX}${sessionId}`

  if (useDevMemorySessions()) {
    const raw = await memoryGet(key)
    if (!raw) return null
    const session = JSON.parse(raw) as SuperAdminSession
    session.last_activity = new Date().toISOString()
    await memorySetex(key, SESSION_TTL, JSON.stringify(session))
    return session
  }

  try {
    const fromRedis = await redis.get<string>(key)
    if (!fromRedis) {
      return null
    }
    const session =
      typeof fromRedis === 'string' ? (JSON.parse(fromRedis) as SuperAdminSession) : (fromRedis as SuperAdminSession)

    session.last_activity = new Date().toISOString()
    const payload = JSON.stringify(session)
    await redis.setex(key, SESSION_TTL, payload)
    return session
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      markDevRedisFallback(err)
      return getSession(sessionId)
    }
    throw err
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionId}`
  if (useDevMemorySessions()) {
    await memoryDel(key)
    return
  }
  try {
    await redis.del(key)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      markDevRedisFallback(err)
      await memoryDel(key)
      return
    }
    throw err
  }
}

export async function validateSession(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId)
  return session !== null && session.role === 'superadmin'
}

export async function getUserSessions(userId: string): Promise<string[]> {
  if (useDevMemorySessions()) {
    const now = Date.now()
    const memorySessions = getMemoryStore()
    const sessions: string[] = []
    for (const [key, entry] of memorySessions) {
      if (!key.startsWith(SESSION_PREFIX) || now > entry.expiresAt) continue
      try {
        const session = JSON.parse(entry.value) as SuperAdminSession
        if (session.user_id === userId) {
          sessions.push(key.replace(SESSION_PREFIX, ''))
        }
      } catch {
        /* skip */
      }
    }
    return sessions
  }

  try {
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
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      markDevRedisFallback(err)
      return getUserSessions(userId)
    }
    throw err
  }
}
