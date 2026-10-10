import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import { isValidRole } from '@/lib/permissions'
import { logResourceEvent } from '@/lib/audit/logger'
import { findAuthUserByEmail, type AuthUserRef } from '@/lib/auth/find-auth-user-by-email'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /admin-api/users/invite
 * Create a new auth user for an email that has no account yet and add it to the
 * caller's company. Existing accounts are rejected with 409 (never re-attached).
 */
export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const permissionCheck = await requirePermissionAsync(req, 'users:invite')
  if (!permissionCheck.authorized) return permissionCheck.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const body = await req.json()
    const { email, companyId, role = 'viewer' } = body

    if (!email || !companyId) {
      return NextResponse.json({ error: 'email and companyId are required' }, { status: 400 })
    }

    if (!isValidRole(role) || role === 'owner') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Fail closed: the caller's company must be known AND equal the target company.
    // (Previously a missing session company skipped this check entirely.)
    if (!permissionCheck.companyId || permissionCheck.companyId !== companyId) {
      return NextResponse.json({ error: 'Forbidden: wrong company' }, { status: 403 })
    }

    const cleanEmail = String(email).toLowerCase().trim()

    // An email that already has an auth account is never attached to a company
    // from here: that would let a company admin pull any registered user (even
    // another tenant's owner) into their company.
    let existingUser: AuthUserRef | null
    try {
      existingUser = await findAuthUserByEmail(supabase, cleanEmail)
    } catch (lookupError) {
      console.error('[Invite] Auth user lookup failed:', lookupError)
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      )
    }

    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: {
        full_name: cleanEmail.split('@')[0],
      },
    })

    if (authError?.code === 'email_exists') {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      )
    }

    if (authError || !newAuthUser.user) {
      console.error('[Invite] Auth user creation error:', authError)
      return NextResponse.json({ error: 'Failed to create user in auth system' }, { status: 500 })
    }

    const userId = newAuthUser.user.id

    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: userId,
        email: cleanEmail,
        full_name: cleanEmail.split('@')[0],
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      console.error('[Invite] User profile error:', profileError)
      return NextResponse.json({ error: 'Failed to save user profile' }, { status: 500 })
    }

    const { data: membership, error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: companyId,
        user_id: userId,
        role,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (memberError || !membership) {
      console.error('[Invite] Membership error:', memberError)
      return NextResponse.json({ error: 'Failed to add user to company' }, { status: 500 })
    }

    await logResourceEvent(req, 'create', 'user', userId, { email: cleanEmail, role, companyId }, 'success')

    return NextResponse.json({
      success: true,
      message: 'User created and added to the company',
      membership,
      loginUrl: `${APP_URL}/login`,
    }, { status: 201 })

  } catch (error) {
    console.error('[Invite] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
