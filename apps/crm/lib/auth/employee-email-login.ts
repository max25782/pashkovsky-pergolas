import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/** Roles allowed on the employee login tab (not owner — owners use admin login). */
export const EMPLOYEE_LOGIN_ROLES = new Set([
  'salesperson',
  'manager',
  'viewer',
  'worker',
  'admin',
])

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface ApprovedMember {
  user_id: string
  role: string
}

async function findApprovedMember(email: string): Promise<ApprovedMember | null> {
  const supabase = getAdminClient()
  if (!supabase) return null

  const cleanEmail = email.toLowerCase().trim()

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  let userId = userRow?.id

  if (!userId) {
    const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authUser = authList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail)
    if (!authUser) return null
    userId = authUser.id
    await supabase.from('users').upsert(
      { id: userId, email: cleanEmail, full_name: cleanEmail.split('@')[0] },
      { onConflict: 'id' },
    )
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('user_id, role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!membership || !EMPLOYEE_LOGIN_ROLES.has(membership.role)) {
    return null
  }

  return { user_id: membership.user_id, role: membership.role }
}

/**
 * Instant login for admin-approved team emails — no password, no email link sent.
 * Creates a Supabase session server-side and returns a redirect with auth cookies.
 */
export async function loginApprovedEmployeeByEmail(
  email: string,
  request: NextRequest,
  redirectTo = '/app',
): Promise<NextResponse> {
  const cleanEmail = email.toLowerCase().trim()
  if (!cleanEmail.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const member = await findApprovedMember(cleanEmail)
  if (!member) {
    return NextResponse.json(
      { error: 'האימייל לא אושר על ידי המנהל. פנה למנהל החברה.' },
      { status: 403 },
    )
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: cleanEmail,
  })

  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('[employee-email-login] generateLink:', linkError)
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
    console.error('[employee-email-login] verifyOtp:', verifyError)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true, redirectTo })

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
