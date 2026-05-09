import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import {
  generateWelcomeEmailHTML,
  generateWelcomeEmailSubject,
} from '@/lib/email/templates/early-bird'

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
 * POST /api/auth/setup-company
 * Create company and link to Supabase Auth user
 */
export async function POST(req: NextRequest) {
  if (!supabase || !SUPABASE_URL) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { user_id, email, full_name, company_name, industry } = body

    // Validate required fields
    if (!user_id || !email || !company_name) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, email, company_name' },
        { status: 400 }
      )
    }


    // Step 1: Check if user already has a company
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user_id)
      .single()

    if (existingMember) {
      return NextResponse.json({ 
        success: true,
        message: 'User already has a company',
        company_id: existingMember.company_id
      })
    }

    // Step 2: Create company (placeholder trial dates — set definitively after Early Bird claim)
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
      })
      .select()
      .single()

    if (companyError || !company) {
      console.error('[Setup Company] Company creation error:', companyError)
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
        user_id: user_id,
        role: 'owner',
        permissions: { all: true },
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('[Setup Company] Membership error:', memberError)
      // Rollback
      await supabase.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // Step 3.5: Atomically claim an Early Bird position. NULL = cohort full.
    // Early birds get 14-day full-access trial; everyone else gets 3 days at default tier.
    let earlyBirdPosition: number | null = null
    {
      const { data: claimed, error: claimError } = await supabase.rpc(
        'claim_early_bird_spot',
        { p_company_id: company.id }
      )
      if (claimError) {
        console.error('[Setup Company] Early Bird claim error:', claimError)
      } else if (typeof claimed === 'number') {
        earlyBirdPosition = claimed
      }
    }

    const isEarlyBird = earlyBirdPosition !== null
    const trialDays = isEarlyBird ? 14 : 3
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()

    // Persist trial deadline on the company row
    const { error: trialUpdateError } = await supabase
      .from('companies')
      .update({ trial_ends_at: trialEndsAt })
      .eq('id', company.id)

    if (trialUpdateError) {
      console.error('[Setup Company] Trial deadline update error:', trialUpdateError)
    }

    // Early birds get full feature access (top tier); regular signups stay on default 'offer'
    if (isEarlyBird) {
      const { error: planError } = await supabase
        .from('users')
        .update({ plan: 'growth' })
        .eq('id', user_id)
      if (planError) {
        console.error('[Setup Company] User plan update error:', planError)
      }
    }

    // Step 4: Create initial subscription (trial plan)
    const { error: subscriptionError } = await supabase
      .from('company_subscriptions')
      .insert({
        company_id: company.id,
        plan: 'trial',
        status: 'active',
        trial_ends_at: trialEndsAt,
        started_at: new Date().toISOString(),
      })

    if (subscriptionError) {
      console.error('[Setup Company] Subscription error:', subscriptionError)
      // Continue anyway, subscription is not critical
    }

    // Step 5: Create default settings
    const { error: settingsError } = await supabase
      .from('company_settings')
      .insert({
        company_id: company.id,
        settings: {
          currency: 'ILS',
          timezone: 'Asia/Jerusalem',
          language: 'he',
        },
      })

    if (settingsError) {
      console.error('[Setup Company] Settings error:', settingsError)
      // Continue anyway, settings are not critical
    }


    // Fire-and-forget welcome email (don't block registration on SMTP latency/failure)
    void (async () => {
      try {
        const opts = {
          fullName: full_name || email.split('@')[0],
          companyName: company.name,
          isEarlyBird,
          earlyBirdPosition,
          trialDays,
        }
        await sendEmail({
          to: email,
          subject: generateWelcomeEmailSubject(opts),
          html: generateWelcomeEmailHTML(opts),
        })
      } catch (err) {
        console.error('[Setup Company] Welcome email failed:', err)
      }
    })()

    return NextResponse.json({
      success: true,
      company_id: company.id,
      company_name: company.name,
      trial_ends_at: trialEndsAt,
      is_early_bird: isEarlyBird,
      early_bird_position: earlyBirdPosition,
      trial_days: trialDays,
    })
  } catch (error) {
    console.error('[Setup Company] Error:', error)
    return NextResponse.json(
      { error: 'Failed to setup company' },
      { status: 500 }
    )
  }
}

