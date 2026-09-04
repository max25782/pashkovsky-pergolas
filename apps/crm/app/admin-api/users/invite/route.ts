import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import { isValidRole } from '@/lib/permissions'
import { logResourceEvent } from '@/lib/audit/logger'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /admin-api/users/invite
 * Approve email for company access — employee logs in with email only (no password).
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

    if (permissionCheck.companyId && permissionCheck.companyId !== companyId) {
      return NextResponse.json({ error: 'Forbidden: wrong company' }, { status: 403 })
    }

    const cleanEmail = email.toLowerCase().trim()

    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingAuthUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
    } else {
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name: cleanEmail.split('@')[0],
        },
      })

      if (authError || !newAuthUser.user) {
        console.error('[Invite] Auth user creation error:', authError)
        return NextResponse.json({ error: 'Failed to create user in auth system' }, { status: 500 })
      }

      userId = newAuthUser.user.id
    }

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

    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id, role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({
        success: true,
        message: 'User is already approved for this company',
        membership: existingMember,
        loginUrl: `${APP_URL}/login?mode=employee&email=${encodeURIComponent(cleanEmail)}`,
      })
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
      message: 'User approved — they can log in with email only',
      membership,
      loginUrl: `${APP_URL}/login?mode=employee&email=${encodeURIComponent(cleanEmail)}`,
    }, { status: 201 })

  } catch (error) {
    console.error('[Invite] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
