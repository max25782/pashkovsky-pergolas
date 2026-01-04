import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requirePermission } from '@/lib/middleware/auth'
import { generateToken, hashToken, getExpirationTime } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/email'
import { logResourceEvent } from '@/lib/audit/logger'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /admin-api/users/invite
 * Invite user to company
 */
export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const permissionCheck = requirePermission(req, 'users:invite' as any)
  if (!permissionCheck.authorized) return permissionCheck.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const body = await req.json()
    const { email, companyId, role = 'viewer' } = body

    if (!email || !companyId) {
      return NextResponse.json({ error: 'email and companyId are required' }, { status: 400 })
    }

    // Validate role
    if (!['admin', 'manager', 'viewer', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if user already exists in auth.users
    const { data: existingAuthUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingAuthUsers?.users?.find(u => u.email === email)
    
    let userId: string

    if (existingUser) {
      // User already exists in auth
      userId = existingUser.id
      console.log('[Invite] User already exists:', userId)
    } else {
      // Create user in Supabase Auth
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: email.split('@')[0],
        },
      })

      if (authError || !newAuthUser.user) {
        console.error('[Invite] Auth user creation error:', authError)
        return NextResponse.json({ error: 'Failed to create user in auth system' }, { status: 500 })
      }

      userId = newAuthUser.user.id
      console.log('[Invite] Created new user:', userId)
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this company' }, { status: 409 })
    }

    // Add user to company
    const { data: membership, error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: companyId,
        user_id: userId,
        role,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (memberError || !membership) {
      console.error('[Invite] Membership error:', memberError)
      return NextResponse.json({ error: 'Failed to add user to company' }, { status: 500 })
    }

    // Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    // Send invitation email with password reset link
    try {
      const inviteUrl = `${APP_URL}/login?email=${encodeURIComponent(email)}`
      
      await sendEmail({
        to: email,
        subject: `Приглашение в ${company?.name || 'компанию'}`,
        html: `
          <h2>Вы приглашены!</h2>
          <p>Вы были приглашены присоединиться к компании <strong>${company?.name || ''}</strong> с ролью <strong>${role}</strong>.</p>
          <p>Для входа перейдите по ссылке и используйте функцию "Забыли пароль" для установки пароля:</p>
          <p><a href="${inviteUrl}">Войти в систему</a></p>
          <p>Ваш email: <strong>${email}</strong></p>
        `,
        text: `Вы приглашены в ${company?.name || 'компанию'}. Перейдите по ссылке для входа: ${inviteUrl}`,
      })
    } catch (emailError) {
      console.error('[Invite] Email sending error:', emailError)
      // Continue anyway - invitation is created
    }

    // Log the invitation
    await logResourceEvent(req, 'create', 'user', userId, { email, role, companyId }, 'success')

    return NextResponse.json({
      success: true,
      message: 'User invited successfully',
      membership,
    }, { status: 201 })

  } catch (error: any) {
    console.error('[Invite] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


