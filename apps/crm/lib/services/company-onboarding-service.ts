/**
 * Company Onboarding Service
 * 
 * Handles manual company onboarding by SuperAdmins:
 * - Create or find user in auth.users
 * - Create company record
 * - Assign user as company owner
 * - Grant enterprise subscription (free, manual)
 * - Optionally send magic link for login
 */

import { createClient } from '@supabase/supabase-js'

// Simple slugify implementation (no external dependency)
function slugify(text: string, options?: { lower?: boolean; strict?: boolean }): string {
  let slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  
  if (options?.strict) {
    slug = slug.replace(/[^a-z0-9\-]/g, '')
  }
  
  return slug
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase configuration for onboarding service')
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface Company {
  id: string
  name: string
  slug: string
  primary_email?: string
  source?: string
  [key: string]: any
}

interface OnboardingResult {
  success: boolean
  company_id?: string
  user_id?: string
  company_name?: string
  error?: string
}

/**
 * Find existing user or create new one
 */
async function findOrCreateUser(email: string): Promise<{ id: string; email: string }> {

  // Check if user exists by listing users and filtering by email
  // Note: getUserByEmail doesn't exist in Supabase Admin API, so we use listUsers
  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()

  if (listError) {
    console.error('[Onboarding] Error listing users:', listError)
    // Continue to create user if listing fails
  } else if (users?.users) {
    // Find user by email
    const existingUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    
    if (existingUser) {
      return { id: existingUser.id, email: existingUser.email || email }
    }
  }

  // Create new user
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true, // Auto-confirm email
  })

  if (createError || !newUser.user) {
    throw new Error(`Failed to create user: ${createError?.message || 'Unknown error'}`)
  }

  return { id: newUser.user.id, email: newUser.user.email || email }
}

/**
 * Create company for user
 */
async function createCompanyForUser(userId: string, email: string): Promise<Company> {
  const companyName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'Company'
  let companySlug = slugify(companyName, { lower: true, strict: true })


  // Check if slug already exists and generate unique one if needed
  let slugSuffix = 0
  let finalSlug = companySlug
  let slugExists = true

  while (slugExists) {
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', finalSlug)
      .limit(1)

    if (!existingCompany || existingCompany.length === 0) {
      slugExists = false
    } else {
      slugSuffix++
      finalSlug = `${companySlug}-${slugSuffix}`
    }
  }

  // Minimal insert - only required fields
  const companyData = {
    name: companyName,
    slug: finalSlug,
    primary_email: email,
    // source: 'manual', // Column doesn't exist in schema
  }

  const { data, error } = await supabaseAdmin
    .from('companies')
    .insert(companyData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create company: ${error.message}`)
  }

  return data as Company
}

/**
 * Assign user as company owner
 */
async function assignOwnerRole(companyId: string, userId: string): Promise<void> {

  const { error } = await supabaseAdmin
    .from('company_members')
    .insert({
      company_id: companyId,
      user_id: userId,
      role: 'owner',
      joined_at: new Date().toISOString(),
      // status defaults to 'active'
    })

  if (error) {
    throw new Error(`Failed to assign owner role: ${error.message}`)
  }

}

/**
 * Grant enterprise subscription (free, manual)
 */
async function grantEnterpriseAccess(companyId: string, adminId: string): Promise<void> {

  const { data: enterprisePlan, error: planError } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('plan_key', 'enterprise')
    .single()

  if (planError || !enterprisePlan) {
    throw new Error(`Failed to get enterprise plan: ${planError?.message || 'Plan not found'}`)
  }

  const { data: existingSub } = await supabaseAdmin
    .from('company_subscriptions')
    .select('id')
    .eq('company_id', companyId)
    .single()

  // Set subscription for 1 month
  const oneMonthFromNow = new Date()
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)

  const subscriptionData = {
    plan_id: enterprisePlan.id,
    status: 'active' as const,
    payment_provider: 'manual' as const,
    auto_renew: false,
    trial_ends_at: null, // No trial period
    current_period_end: oneMonthFromNow.toISOString(), // Expires in 1 month
    next_billing_date: oneMonthFromNow.toISOString(), // Next billing in 1 month
    // billing_cycle omitted (has CHECK constraint, not needed for manual)
  }

  if (existingSub) {
    const { error: updateError } = await supabaseAdmin
      .from('company_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSub.id)

    if (updateError) {
      throw new Error(`Failed to update subscription: ${updateError.message}`)
    }
  } else {
    const { error: subError } = await supabaseAdmin
      .from('company_subscriptions')
      .insert({
        company_id: companyId,
        ...subscriptionData,
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
    console.error('[Onboarding] Failed to log subscription history:', historyError.message)
  }
}

/**
 * Send magic link to user
 */
async function sendMagicLink(email: string, baseUrl: string): Promise<{ sent: boolean; url?: string }> {

  try {
    const redirectUrl = `${baseUrl}/app/admin`

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error || !data) {
      console.error('[Onboarding] Failed to generate magic link:', error?.message)
      return { sent: false }
    }


    return {
      sent: true,
      url: data.properties.action_link,
    }
  } catch (error) {
    console.error('[Onboarding] Exception generating magic link:', error)
    return { sent: false }
  }
}

/**
 * Main onboarding function
 */
export async function onboardCompany(
  email: string,
  adminId: string
): Promise<OnboardingResult> {
  try {

    // 1. Find or create user
    const user = await findOrCreateUser(email)

    // 1.5. Check if user already has a company
    const { data: existingMemberships } = await supabaseAdmin
      .from('company_members')
      .select('company_id, companies(id, name, slug)')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .limit(1)

    if (existingMemberships && existingMemberships.length > 0) {
      const existingCompany = existingMemberships[0].companies as any
      
      return {
        success: false,
        error: `User ${email} already has a company: "${existingCompany.name}" (ID: ${existingCompany.id}). Each user can only have one company.`,
        company_id: existingCompany.id,
        user_id: user.id,
        company_name: existingCompany.name,
      }
    }

    // 2. Create company
    const company = await createCompanyForUser(user.id, email)

    // 3. Assign owner role
    await assignOwnerRole(company.id, user.id)

    // 4. Grant enterprise access
    await grantEnterpriseAccess(company.id, adminId)

    return {
      success: true,
      company_id: company.id,
      user_id: user.id,
      company_name: company.name,
    }
  } catch (error: unknown) {
    console.error('[Onboarding] Onboarding failed:', error)
    return {
      success: false,
      error: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
    }
  }
}
