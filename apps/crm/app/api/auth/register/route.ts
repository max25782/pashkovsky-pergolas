import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'
import { generateToken, hashToken, getExpirationTime } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/email'
import { rateLimiters } from '@/lib/middleware/rate-limit'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
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
 * Register a new company with owner user
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = rateLimiters.auth.register(req as any)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: rateLimitResult.retryAfter 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter || 3600),
        }
      }
    )
  }

  if (!supabase || !SUPABASE_URL) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { email, password, full_name, company_name, industry } = body

    // Validate required fields
    if (!email || !password || !full_name || !company_name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, full_name, company_name' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(password)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Step 1: Create user record (email not verified yet)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name,
        // email_verified_at will be set after email verification
      })
      .select()
      .single()

    if (userError || !user) {
      console.error('[Register] User creation error:', userError)
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Step 2: Create company
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
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
      })
      .select()
      .single()

    if (companyError || !company) {
      console.error('[Register] Company creation error:', companyError)
      // Rollback
      await supabase.from('users').delete().eq('id', user.id)
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    // Step 3: Add user as owner of the company
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('[Register] Membership error:', memberError)
      // Rollback
      await supabase.from('companies').delete().eq('id', company.id)
      await supabase.from('users').delete().eq('id', user.id)
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // Step 4: Create initial subscription (trial plan)
    const { data: trialPlan } = await supabase
      .from('plans')
      .select('id')
      .eq('key', 'trial')
      .single()

    if (trialPlan) {
      await supabase
        .from('subscriptions')
        .insert({
          company_id: company.id,
          plan_id: trialPlan.id,
          status: 'trialing',
          payment_provider: 'manual',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
    }

    // Step 5: Create email verification token
    const verificationToken = generateToken()
    const verificationTokenHash = hashToken(verificationToken)
    const expiresAt = getExpirationTime(24) // 24 hours

    await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: verificationTokenHash,
        expires_at: expiresAt,
      })

    // Step 6: Send verification email (don't fail if email fails)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verificationUrl = `${APP_URL}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`

    try {
      await sendEmail({
        to: email,
        subject: 'Подтвердите ваш email',
        html: `
          <h2>Добро пожаловать!</h2>
          <p>Спасибо за регистрацию. Пожалуйста, подтвердите ваш email, нажав на ссылку ниже:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>Ссылка действительна в течение 24 часов.</p>
        `,
        text: `Подтвердите ваш email: ${verificationUrl}`,
      })
    } catch (emailError) {
      console.error('[Register] Email sending error:', emailError)
      // Continue anyway - user can request verification email later
    }

    // Step 7: Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      companyId: company.id,
      role: 'owner',
    })

    // Success!
    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        plan: 'trial',
      },
    }, { status: 201 })

  } catch (error: any) {
    console.error('[Register] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

