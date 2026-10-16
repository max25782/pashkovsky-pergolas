import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { findAuthUserByEmail } from '@/lib/auth/find-auth-user-by-email'

/** Schema `user_role` values allowed on the employee tab. All others are denied. */
export const EMPLOYEE_LOGIN_ALLOWED_ROLES = ['salesperson', 'worker', 'viewer'] as const
export type EmployeeLoginAllowedRole = (typeof EMPLOYEE_LOGIN_ALLOWED_ROLES)[number]

export const EMPLOYEE_LOGIN_DENIED_STATUS = 403
export const EMPLOYEE_LOGIN_DENIED_ERROR =
  'Sign-in was not approved. | הכניסה לא אושרה.'

export const EMPLOYEE_LOGIN_RATE_LIMIT_STATUS = 429
export const EMPLOYEE_LOGIN_IP_LIMIT_PER_MINUTE = 5
export const EMPLOYEE_LOGIN_EMAIL_LIMIT_PER_HOUR = 20

const NIL_USER_ID = '00000000-0000-0000-0000-000000000000'
const IP_WINDOW_MS = 60_000
const EMAIL_WINDOW_MS = 60 * 60_000

export interface EmployeeMembershipRow {
  user_id: string
  company_id: string
  role: string
}

export type EmployeeMembershipDenial = 'no_memberships' | 'multiple_memberships' | 'forbidden_role'

export type EmployeeMembershipDecision =
  | { ok: true; user_id: string; company_id: string; role: EmployeeLoginAllowedRole }
  | { ok: false; reason: EmployeeMembershipDenial }

export function normalizeEmployeeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isAllowedEmployeeRole(role: string): role is EmployeeLoginAllowedRole {
  return (EMPLOYEE_LOGIN_ALLOWED_ROLES as readonly string[]).includes(role)
}

/**
 * Allow login only when there is exactly one membership and its role is
 * salesperson, worker, or viewer. Owner/admin/manager, unknown roles,
 * zero rows, and more than one row are all refusals.
 *
 * Callers must pass every membership for the user. Using `.limit(1)` here
 * would hide a second (e.g. owner) row and incorrectly allow login.
 */
export function decideEmployeeMembership(memberships: EmployeeMembershipRow[]): EmployeeMembershipDecision {
  if (memberships.length === 0) return { ok: false, reason: 'no_memberships' }
  if (memberships.length !== 1) return { ok: false, reason: 'multiple_memberships' }
  const only = memberships[0]
  if (!isAllowedEmployeeRole(only.role)) return { ok: false, reason: 'forbidden_role' }
  return { ok: true, user_id: only.user_id, company_id: only.company_id, role: only.role }
}

export function hashOpaque(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const ipHits = new Map<string, number[]>()
const emailHits = new Map<string, number[]>()

function wouldExceed(store: Map<string, number[]>, key: string, windowMs: number, now: number, max: number): boolean {
  const kept = (store.get(key) ?? []).filter((t) => now - t < windowMs)
  store.set(key, kept)
  return kept.length >= max
}

function recordHit(store: Map<string, number[]>, key: string, now: number): void {
  const kept = store.get(key) ?? []
  kept.push(now)
  store.set(key, kept)
}

/**
 * In-memory sliding windows for this process only. Weaker than Redis: a
 * cold start resets counters, and each instance has its own buckets.
 * A store failure cannot happen here, so a salesperson is never blocked
 * by rate-limit infrastructure being down.
 */
export function checkEmployeeLoginRateLimit(ip: string, email: string, now = Date.now()): boolean {
  const ipKey = hashOpaque(ip)
  const emailKey = hashOpaque(email)
  if (wouldExceed(ipHits, ipKey, IP_WINDOW_MS, now, EMPLOYEE_LOGIN_IP_LIMIT_PER_MINUTE)) return false
  if (wouldExceed(emailHits, emailKey, EMAIL_WINDOW_MS, now, EMPLOYEE_LOGIN_EMAIL_LIMIT_PER_HOUR)) return false
  recordHit(ipHits, ipKey, now)
  recordHit(emailHits, emailKey, now)
  return true
}

export function resetEmployeeLoginRateLimitForTests(): void {
  ipHits.clear()
  emailHits.clear()
}

export function deniedEmployeeLoginResponse(status: number = EMPLOYEE_LOGIN_DENIED_STATUS): NextResponse {
  return NextResponse.json({ error: EMPLOYEE_LOGIN_DENIED_ERROR }, { status })
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function logAttempt(entry: {
  outcome: 'success' | 'denied'
  reason: string
  userId?: string
  ipHash: string
}): void {
  const line: Record<string, string> = {
    event: 'employee_login',
    outcome: entry.outcome,
    reason: entry.reason,
    ipHash: entry.ipHash,
  }
  if (entry.userId) line.userId = entry.userId
  console.info(JSON.stringify(line))
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Instant login for a single-company employee (salesperson / worker / viewer).
 * Session is minted only after every check; company comes from that one row.
 */
export async function loginApprovedEmployeeByEmail(
  email: string,
  request: NextRequest,
  redirectTo = '/app',
): Promise<NextResponse> {
  const cleanEmail = normalizeEmployeeEmail(email)
  const ip = clientIp(request)
  const ipHash = hashOpaque(ip)

  if (!checkEmployeeLoginRateLimit(ip, cleanEmail)) {
    logAttempt({ outcome: 'denied', reason: 'rate_limited', ipHash })
    return deniedEmployeeLoginResponse(EMPLOYEE_LOGIN_RATE_LIMIT_STATUS)
  }

  if (!cleanEmail.includes('@')) {
    logAttempt({ outcome: 'denied', reason: 'no_user', ipHash })
    return deniedEmployeeLoginResponse()
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  let authUser: { id: string; email: string } | null
  try {
    authUser = await findAuthUserByEmail(admin, cleanEmail)
  } catch {
    logAttempt({ outcome: 'denied', reason: 'lookup_failed', ipHash })
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const lookupUserId = authUser?.id ?? NIL_USER_ID
  const { data: memberships, error: memberError } = await admin
    .from('company_members')
    .select('user_id, company_id, role')
    .eq('user_id', lookupUserId)

  if (memberError) {
    logAttempt({ outcome: 'denied', reason: 'lookup_failed', ipHash })
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  if (!authUser) {
    logAttempt({ outcome: 'denied', reason: 'no_user', ipHash })
    return deniedEmployeeLoginResponse()
  }

  const decision = decideEmployeeMembership((memberships ?? []) as EmployeeMembershipRow[])
  if (!decision.ok) {
    logAttempt({ outcome: 'denied', reason: decision.reason, ipHash })
    return deniedEmployeeLoginResponse()
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: cleanEmail,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('[employee-email-login] generateLink failed')
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    },
  )

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })

  if (verifyError) {
    console.error('[employee-email-login] verifyOtp failed')
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }

  logAttempt({
    outcome: 'success',
    reason: 'ok',
    userId: decision.user_id,
    ipHash,
  })

  const response = NextResponse.json({
    ok: true,
    redirectTo,
    companyId: decision.company_id,
    role: decision.role,
  })

  for (const c of cookiesToSet) {
    response.cookies.set({
      name: c.name,
      value: c.value,
      ...c.options,
      httpOnly: c.options?.httpOnly ?? true,
      secure: c.options?.secure ?? process.env.NODE_ENV === 'production',
      sameSite: c.options?.sameSite ?? 'lax',
      path: c.options?.path ?? '/',
    })
  }

  return response
}
