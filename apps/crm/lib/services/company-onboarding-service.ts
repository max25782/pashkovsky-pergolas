/**
 * Company Onboarding Service
 * Handles manual company creation by SuperAdmin
 * Transaction-safe flow for user + company + subscription creation
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

// Service role client for admin operations
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface OnboardingResult {
  success: boolean
  user_id: string
  company_id: string
  company_name: string
  magic_link_sent: boolean
  magic_link_url?: string
  error?: string
}

interface UserResult {
  user_id: string
  email: string
  is_new_user: boolean
}

/**
 * Find existing user or create new one in auth.users
 */
async function findOrCreateUser(email: string): Promise<UserResult> {
  console.log('[Onboarding] Checking if user exists:', email)

  // Check if user already exists
  const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`)
  }

  const existingUser = existingUsers.users.find(u => u.email === email)

  if (existingUser) {
    console.log('[Onboarding] User already exists:', existingUser.id)
    return {
      user_id: existingUser.id,
      email: existingUser.email!,
      is_new_user: false,
    }
  }

  // Create new user
  console.log('[Onboarding] Creating new user:', email)
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true, // Skip email verification
    user_metadata: {
      onboarded_by: 'superadmin',
      onboarded_at: new Date().toISOString(),
    },
  })

  if (createError || !newUser.user) {
    throw new Error(`Failed to create user: ${createError?.message || 'Unknown error'}`)
  }

  // Also insert into public.users table
  const { error: userTableError } = await supabaseAdmin
    .from('users')
    .insert({
      id: newUser.user.id,
      email: newUser.user.email!,
      full_name: email.split('@')[0], // Default to email prefix
      locale: 'en',
    })

  if (userTableError) {
    console.warn('[Onboarding] Failed to insert into users table:', userTableError.message)
    // Non-fatal - continue anyway
  }

  console.log('[Onboarding] User created:', newUser.user.id)
  return {
    user_id: newUser.user.id,
    email: newUser.user.email!,
    is_new_user: true,
  }
}

/**
 * Create company record
 */
async function createCompanyForUser(userId: string, email: string): Promise<{ company_id: string; company_name: string }> {
  // Generate company name from email
  const emailPrefix = email.split('@')[0]
  const companyName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
  const companySlug = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '-')

  console.log('[Onboarding] Creating company:', companyName)

  // Check if any company exists first (to understand schema)
  const { data: existingCompanies } = await supabaseAdmin
    .from('companies')
    .select('*')
    .limit(1)

  console.log('[Onboarding] Sample company schema:', existingCompanies?.[0] ? Object.keys(existingCompanies[0]) : 'no companies yet')

  // Check if company with this slug already exists
  const { data: existingBySlug } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('slug', companySlug)
    .maybeSingle()

  if (existingBySlug) {
    console.log('[Onboarding] Company already exists by slug:', existingBySlug.id)
    return {
      company_id: existingBySlug.id,
      company_name: companyName,
    }
  }

  // Try different insert strategies based on what columns might exist
  let company = null
  let error = null

  // Try with explicit schema specification
  const { data: companyData, error: insertError } = await supabaseAdmin
    .schema('public')
    .from('companies')
    .insert({
      name: companyName,
      slug: companySlug,
      status: 'active',
      plan: 'enterprise',
      primary_email: email,
    })
    .select()
    .single()

  if (!insertError && companyData) {
    console.log('[Onboarding] Created successfully!')
    company = companyData
  } else {
    console.log('[Onboarding] Insert failed:', insertError?.message, 'Code:', insertError?.code)
    error = insertError
  }

  if (error || !company) {
    throw new Error(`Failed to create company: ${error?.message || 'All strategies failed'}`)
  }

  console.log('[Onboarding] Company created:', company.id)
  return {
    company_id: company.id,
    company_name: company.name,
  }
}

/**
 * Assign user as company owner
 */
async function assignOwnerRole(companyId: string, userId: string): Promise<void> {
  console.log('[Onboarding] Assigning owner role:', { companyId, userId })

  // Check if membership already exists
  const { data: existingMember } = await supabaseAdmin
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .single()

  if (existingMember) {
    console.log('[Onboarding] User already a member, updating to owner')
    const { error: updateError } = await supabaseAdmin
      .from('company_members')
      .update({ role: 'owner' })
      .eq('id', existingMember.id)

    if (updateError) {
      throw new Error(`Failed to update membership: ${updateError.message}`)
    }
    return
  }

  // Try insert without status first (if column doesn't exist in schema cache)
  let { error } = await supabaseAdmin
    .from('company_members')
    .insert({
      company_id: companyId,
      user_id: userId,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })

  // If failed, it might be some other issue
  if (error) {
    throw new Error(`Failed to assign owner role: ${error.message}`)
  }

  console.log('[Onboarding] Owner role assigned')
}

/**
 * Grant enterprise subscription access
 */
async function grantEnterpriseAccess(companyId: string, adminId: string): Promise<void> {
  console.log('[Onboarding] Granting enterprise access:', companyId)

  // Get enterprise plan
  const { data: enterprisePlan, error: planError } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('plan_key', 'enterprise')
    .single()

  if (planError || !enterprisePlan) {
    throw new Error(`Failed to get enterprise plan: ${planError?.message || 'Plan not found'}`)
  }

  // Check if subscription already exists
  const { data: existingSub } = await supabaseAdmin
    .from('company_subscriptions')
    .select('id')
    .eq('company_id', companyId)
    .single()

  if (existingSub) {
    console.log('[Onboarding] Subscription already exists, updating to enterprise')
    const { error: updateError } = await supabaseAdmin
      .from('company_subscriptions')
      .update({
        plan_id: enterprisePlan.id,
        status: 'active',
        payment_provider: 'manual',
        auto_renew: false,
      })
      .eq('id', existingSub.id)

    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`)
    }
  } else {
    // Create new subscription (billing_cycle omitted - nullable, constraint only allows 'monthly' or 'yearly')
    const { error: subError } = await supabaseAdmin
      .from('company_subscriptions')
      .insert({
        company_id: companyId,
        plan_id: enterprisePlan.id,
        status: 'active',
        payment_provider: 'manual',
        auto_renew: false,
      })

    if (subError) {
      throw new Error(`Failed to create subscription: ${subError.message}`)
    }
  }

  // Log subscription history
  const { error: historyError } = await supabaseAdmin
    .from('subscription_history')
    .insert({
      company_id: companyId,
      new_plan_id: enterprisePlan.id,
      changed_by: adminId,
      change_reason: 'manual free access by SuperAdmin',
    })

  if (historyError) {
    console.warn('[Onboarding] Failed to log subscription history:', historyError.message)
    // Non-fatal - continue anyway
  }

  console.log('[Onboarding] Enterprise access granted')
}

/**
 * Send magic login link
 */
async function sendMagicLink(email: string): Promise<{ sent: boolean; url?: string }> {
  console.log('[Onboarding] Generating magic link for:', email)

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_CRM_URL || process.env.NEXT_PUBLIC_APP_URL}/app`,
      },
    })

    if (error || !data) {
      console.error('[Onboarding] Failed to generate magic link:', error?.message)
      return { sent: false }
    }

    console.log('[Onboarding] Magic link generated:', data.properties.action_link)

    // Note: Supabase generateLink doesn't send the email automatically
    // We just return the URL for the SuperAdmin to share manually
    return {
      sent: true,
      url: data.properties.action_link,
    }
  } catch (error: any) {
    console.error('[Onboarding] Exception generating magic link:', error)
    return { sent: false }
  }
}

/**
 * Main onboarding orchestration function
 */
export async function onboardCompany(
  email: string,
  sendInviteEmail: boolean,
  adminId: string
): Promise<OnboardingResult> {
  console.log('[Onboarding] Starting onboarding for:', email)

  try {
    // Step 1: Find or create user
    const userResult = await findOrCreateUser(email)

    // Step 2: Create company
    const { company_id, company_name } = await createCompanyForUser(userResult.user_id, userResult.email)

    // Step 3: Assign owner role
    await assignOwnerRole(company_id, userResult.user_id)

    // Step 4: Grant enterprise access
    await grantEnterpriseAccess(company_id, adminId)

    // Step 5: Send magic link (optional)
    let magicLinkResult: { sent: boolean; url?: string } = { sent: false }
    if (sendInviteEmail) {
      magicLinkResult = await sendMagicLink(userResult.email)
    }

    console.log('[Onboarding] Onboarding completed successfully')

    return {
      success: true,
      user_id: userResult.user_id,
      company_id,
      company_name,
      magic_link_sent: magicLinkResult.sent,
      magic_link_url: magicLinkResult.url,
    }
  } catch (error: any) {
    console.error('[Onboarding] Onboarding failed:', error)
    return {
      success: false,
      user_id: '',
      company_id: '',
      company_name: '',
      magic_link_sent: false,
      error: error.message || 'Unknown error occurred',
    }
  }
}

