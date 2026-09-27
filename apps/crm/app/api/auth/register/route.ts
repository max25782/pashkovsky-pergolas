import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validatePasswordStrength } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'
import { generateToken, hashToken, getExpirationTime } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/email'
import { rateLimiters } from '@/lib/middleware/rate-limit'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Service-role client for DB writes (schema = public)
const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Admin auth client for auth.admin.createUser / deleteUser
const supabaseAdmin = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : undefined

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

/**
 * POST /api/auth/register
 * Register a new company with owner user.
 *
 * Flow:
 *   1. auth.admin.createUser()  → creates auth.users row
 *                               → handle_new_auth_user trigger mirrors to public.users
 *   2. Insert company
 *   3. Insert company_members   → company_members_user_id_fkey references auth.users(id)
 *   4. Insert subscription
 *   5. Send verification email
 *   6. Return custom JWT
 *
 * Rollback: on any failure after step 1, auth.admin.deleteUser() cascades to company_members.
 *           Company is deleted explicitly. public.users is cleaned up separately if needed.
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.auth.register(req)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitResult.retryAfter || 3600) },
      }
    )
  }

  if (!supabase || !supabaseAdmin || !SUPABASE_URL) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { email, password, full_name, company_name, industry } = body as Record<string, string>

  // --- Validation ---
  if (!email || !password || !full_name || !company_name) {
    return NextResponse.json(
      { error: 'Missing required fields: email, password, full_name, company_name' },
      { status: 400 }
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }
  const passwordCheck = validatePasswordStrength(password)
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 })
  }

  // --- Step 1: Create user in auth.users ---
  // handle_new_auth_user trigger will mirror to public.users automatically.
  // email_confirm: true so the user can sign in immediately; custom verification below.
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (authError || !authData.user) {
    console.error('[Register] auth.admin.createUser error:', authError)
    // Email already exists comes through as a specific error message
    if (authError?.message?.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
  }

  const authUserId = authData.user.id

  // Wait briefly for the trigger to sync to public.users, then proceed.
  // (The trigger runs synchronously in the same transaction, so no sleep needed.)

  // --- Step 2: Create company ---
  const slug = generateSlug(company_name)
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      name: company_name,
      slug,
      status: 'trial',
      plan: 'trial',
      industry: industry || 'general',
      primary_email: email,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (companyError || !company) {
    console.error('[Register] Company creation error:', companyError)
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }

  // --- Step 3: Add user as owner (user_id → auth.users(id)) ---
  const { error: memberError } = await supabase
    .from('company_members')
    .insert({
      company_id: company.id,
      user_id: authUserId,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })

  if (memberError) {
    console.error('[Register] Membership error:', memberError)
    await supabase.from('companies').delete().eq('id', company.id)
    await supabaseAdmin.auth.admin.deleteUser(authUserId) // cascades company_members, public.users via trigger
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 })
  }

  // --- Step 4: Trial subscription (optional — fail open) ---
  const { data: trialPlan } = await supabase
    .from('plans')
    .select('id')
    .eq('key', 'trial')
    .single()

  if (trialPlan) {
    await supabase.from('subscriptions').insert({
      company_id: company.id,
      plan_id: trialPlan.id,
      status: 'trialing',
      payment_provider: 'manual',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  // --- Step 5: Send verification email (fail open) ---
  const verificationToken = generateToken()
  const verificationTokenHash = hashToken(verificationToken)
  const expiresAt = getExpirationTime(24)

  await supabase.from('email_verification_tokens').insert({
    user_id: authUserId,
    token: verificationTokenHash,
    expires_at: expiresAt,
  })

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const verificationUrl = `${APP_URL}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`

  try {
    await sendEmail({
      to: email,
      subject: 'Подтвердите ваш email — AluminCRM',
      html: `
        <h2>Добро пожаловать!</h2>
        <p>Спасибо за регистрацию. Пожалуйста, подтвердите ваш email:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>Ссылка действительна 24 часа.</p>
      `,
      text: `Подтвердите ваш email: ${verificationUrl}`,
    })
  } catch (emailError) {
    console.error('[Register] Email error (non-fatal):', emailError)
  }

  // --- Step 6: Return custom JWT ---
  const token = signToken({
    userId: authUserId,
    email,
    companyId: company.id,
    role: 'owner',
  })

  return NextResponse.json(
    {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      token,
      user: { id: authUserId, email, full_name },
      company: { id: company.id, name: company.name, slug: company.slug, plan: 'trial' },
    },
    { status: 201 }
  )
}
