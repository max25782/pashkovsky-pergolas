import { createClient } from '@supabase/supabase-js'
import { sendEmail, generateMagicLinkEmailHTML } from '@/lib/email'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Roles that may use passwordless employee login (not company owner signup). */
export const EMPLOYEE_LOGIN_ROLES = new Set([
  'salesperson',
  'manager',
  'viewer',
  'worker',
  'admin',
])

export interface SendTeamMemberMagicLinkResult {
  ok: boolean
  emailSent: boolean
  emailError?: string
  error?: string
}

function getAdminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Send a one-click login link to a team member invited to a company.
 * Returns ok:true even when email is unknown (anti-enumeration) unless checkOnly.
 */
export async function sendTeamMemberMagicLink(
  email: string,
  origin: string,
  options?: { checkOnly?: boolean },
): Promise<SendTeamMemberMagicLinkResult> {
  const supabase = getAdminClient()
  if (!supabase) {
    return { ok: false, emailSent: false, error: 'Server not configured' }
  }

  const cleanEmail = email.toLowerCase().trim()
  if (!cleanEmail.includes('@')) {
    return { ok: false, emailSent: false, error: 'Invalid email' }
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (!userRow?.id) {
    return { ok: true, emailSent: false }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', userRow.id)
    .limit(1)
    .maybeSingle()

  if (!membership || !EMPLOYEE_LOGIN_ROLES.has(membership.role)) {
    return { ok: true, emailSent: false }
  }

  if (options?.checkOnly) {
    return { ok: true, emailSent: false }
  }

  const callbackUrl = `${origin}/auth/callback?next=/app`

  const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUser = authList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail)
  const linkType = authUser ? 'recovery' : 'invite'

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: linkType as 'recovery' | 'invite',
    email: cleanEmail,
    options: { redirectTo: callbackUrl },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return {
      ok: false,
      emailSent: false,
      error: linkError?.message ?? 'Failed to generate login link',
    }
  }

  const actionLink = linkData.properties.action_link

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { ok: false, emailSent: false, error: 'Email not configured' }
  }

  try {
    await sendEmail({
      to: cleanEmail,
      subject: 'קישור כניסה ל-CRM — AluminCRM',
      html: generateMagicLinkEmailHTML(actionLink, cleanEmail),
    })
    return { ok: true, emailSent: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send email'
    return { ok: false, emailSent: false, error: message }
  }
}
