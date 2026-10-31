/**
 * Shared "tell the owners" plumbing for event notifications (offer approved,
 * new AI-chat lead, ...). Recipients are resolved per company, e-mail goes to
 * everyone, WhatsApp goes to the company phone and only when the caller supplies
 * an approved template name (Meta rejects free-form business messages).
 *
 * Every failure is logged with context and reported in the return value; nothing
 * here throws, because a failed notification must not break the user-facing flow.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { sendWhatsAppTemplate } from '@/lib/whatsapp-send'

export interface CompanyRecipients {
  emails: string[]
  phone: string | null
}

/**
 * Owners/admins of the company, any extra users (e.g. the author of a record)
 * and the company's own contact e-mail/phone.
 */
export async function resolveCompanyRecipients(
  supabase: SupabaseClient,
  companyId: string,
  extraUserIds: (string | null | undefined)[] = [],
): Promise<CompanyRecipients> {
  const emails = new Set<string>()
  const userIds = new Set<string>()
  for (const id of extraUserIds) if (id) userIds.add(id)

  const { data: members, error: membersError } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role', ['owner', 'admin'])
  if (membersError) {
    console.error('[company-notify] company_members lookup failed:', membersError)
  }
  for (const m of members ?? []) userIds.add(String((m as { user_id: string }).user_id))

  if (userIds.size > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('email')
      .in('id', [...userIds])
    if (usersError) console.error('[company-notify] users lookup failed:', usersError)
    for (const u of users ?? []) {
      const email = (u as { email: string | null }).email?.trim()
      if (email) emails.add(email.toLowerCase())
    }
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('primary_email, primary_phone, phone')
    .eq('id', companyId)
    .maybeSingle()
  if (companyError) console.error('[company-notify] company lookup failed:', companyError)
  const row = company as { primary_email?: string | null; primary_phone?: string | null; phone?: string | null } | null
  const primaryEmail = row?.primary_email?.trim()
  if (primaryEmail) emails.add(primaryEmail.toLowerCase())

  return {
    emails: [...emails],
    phone: row?.primary_phone?.trim() || row?.phone?.trim() || null,
  }
}

export interface NotifyOutcome {
  emailsSent: number
  whatsappSent: boolean
}

export async function notifyRecipients(
  recipients: CompanyRecipients,
  message: {
    subject: string
    html: string
    /** Name of the env var that holds the approved WhatsApp template. */
    whatsappTemplateEnv?: string
    whatsappParams?: string[]
  },
  logPrefix: string,
): Promise<NotifyOutcome> {
  const outcome: NotifyOutcome = { emailsSent: 0, whatsappSent: false }

  if (recipients.emails.length === 0) {
    console.warn(`${logPrefix} no e-mail recipients`)
  } else {
    const results = await Promise.allSettled(
      recipients.emails.map((to) => sendEmail({ to, subject: message.subject, html: message.html })),
    )
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') outcome.emailsSent += 1
      else console.error(`${logPrefix} e-mail to`, recipients.emails[i], 'failed:', r.reason)
    })
  }

  const templateName = message.whatsappTemplateEnv ? process.env[message.whatsappTemplateEnv] : undefined
  if (templateName && recipients.phone) {
    const wa = await sendWhatsAppTemplate(recipients.phone, templateName, message.whatsappParams)
    outcome.whatsappSent = wa.ok
    if (!wa.ok) console.error(`${logPrefix} WhatsApp failed:`, wa.error)
  }

  return outcome
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
