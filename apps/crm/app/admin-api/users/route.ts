import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requirePermission } from '@/lib/middleware/auth'
import { logResourceEvent } from '@/lib/audit/logger'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * GET /admin-api/users
 * List users in company (admin only)
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const permissionCheck = requirePermission(req, 'users:view' as any)
  if (!permissionCheck.authorized) return permissionCheck.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    // Get company memberships
    const { data: memberships, error } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Users] Fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // Get auth users data
    const { data: authData } = await supabase.auth.admin.listUsers()
    const authUsers = authData?.users || []

    // Create user map
    const userMap = new Map(authUsers.map(u => [u.id, {
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
      avatar_url: u.user_metadata?.avatar_url || null,
      email_verified_at: u.email_confirmed_at,
      last_login_at: u.last_sign_in_at,
      created_at: u.created_at,
    }]))

    // Combine memberships with user data
    const users = memberships.map(m => {
      const userData = userMap.get(m.user_id)
      return {
        id: m.user_id,
        email: userData?.email || 'unknown',
        full_name: userData?.full_name || 'Unknown User',
        avatar_url: userData?.avatar_url,
        email_verified_at: userData?.email_verified_at,
        last_login_at: userData?.last_login_at,
        created_at: userData?.created_at || m.created_at,
        role: m.role,
        joinedAt: m.joined_at,
      }
    })

    return NextResponse.json({ users })

  } catch (error: any) {
    console.error('[Users] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /admin-api/users
 * Update user role in company
 */
export async function PATCH(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const permissionCheck = requirePermission(req, 'users:edit_roles' as any)
  if (!permissionCheck.authorized) return permissionCheck.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const body = await req.json()
    const { userId, companyId, role } = body

    if (!userId || !companyId || !role) {
      return NextResponse.json({ error: 'userId, companyId, and role are required' }, { status: 400 })
    }

    // Validate role
    if (!['owner', 'admin', 'manager', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Update role
    const { data, error } = await supabase
      .from('company_members')
      .update({ role })
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      console.error('[Users] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the change
    await logResourceEvent(req, 'update', 'user', userId, { role }, 'success')

    return NextResponse.json({ success: true, membership: data })

  } catch (error: any) {
    console.error('[Users] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /admin-api/users
 * Remove user from company
 */
export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const permissionCheck = requirePermission(req, 'users:remove' as any)
  if (!permissionCheck.authorized) return permissionCheck.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    const companyId = searchParams.get('company_id')

    if (!userId || !companyId) {
      return NextResponse.json({ error: 'user_id and company_id are required' }, { status: 400 })
    }

    // Don't allow removing the last owner
    const { data: owners } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'owner')

    if (owners && owners.length === 1) {
      const { data: member } = await supabase
        .from('company_members')
        .select('role')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .single()

      if (member?.role === 'owner') {
        return NextResponse.json(
          { error: 'Cannot remove the last owner of the company' },
          { status: 400 }
        )
      }
    }

    // Remove user from company
    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId)

    if (error) {
      console.error('[Users] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log the removal
    await logResourceEvent(req, 'delete', 'user', userId, { companyId }, 'success')

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Users] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



