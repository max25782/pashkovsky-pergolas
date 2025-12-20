import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, requirePermission } from '@/lib/middleware/auth'
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
  const authCheck = requireAuth(req)
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
    if (!['admin', 'manager', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Cannot invite as owner.' }, { status: 400 })
    }

    // Check if user already exists
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    // If user doesn't exist, create them (they'll need to set password on first login)
    if (!user) {
      // Generate temporary password
      const tempPassword = generateToken(16)
      const { hashPassword } = await import('@/lib/auth/password')
      const passwordHash = await hashPassword(tempPassword)

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: passwordHash,
          full_name: email.split('@')[0], // Use email prefix as name
        })
        .select()
        .single()

      if (createError || !newUser) {
        console.error('[Invite] User creation error:', createError)
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
      }

      user = newUser
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id')
      .eq('user_id', user.id)
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
        user_id: user.id,
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

    // Send invitation email
    try {
      const inviteUrl = `${APP_URL}/auth/accept-invite?token=${generateToken()}&email=${encodeURIComponent(email)}`
      
      await sendEmail({
        to: email,
        subject: `Приглашение в ${company?.name || 'компанию'}`,
        html: `
          <h2>Вы приглашены!</h2>
          <p>Вы были приглашены присоединиться к компании <strong>${company?.name || ''}</strong> с ролью <strong>${role}</strong>.</p>
          <p><a href="${inviteUrl}">Принять приглашение</a></p>
          <p>Или перейдите по ссылке: ${inviteUrl}</p>
        `,
        text: `Вы приглашены в ${company?.name || 'компанию'}. Перейдите по ссылке: ${inviteUrl}`,
      })
    } catch (emailError) {
      console.error('[Invite] Email sending error:', emailError)
      // Continue anyway - invitation is created
    }

    // Log the invitation
    await logResourceEvent(req, 'create', 'user', user.id, { email, role, companyId }, 'success')

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


