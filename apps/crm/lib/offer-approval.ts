/**
 * What happens after a customer signs an offer (POST /api/offers/[id]/approve):
 *  1. any deal still on new / measure / offer moves to "offer approved";
 *     a hidden quick-offer deal is also promoted onto the CRM board;
 *  2. the owners/admins and the person who made the offer are notified by
 *     e-mail, and by WhatsApp when a template is configured.
 *
 * Every step is best effort: the customer's signature is already stored by the
 * time this runs, so a failed e-mail must never turn into an error for them.
 * Failures are logged with context instead of being swallowed.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { trySyncDealPrice } from '@/lib/deals/deal-price-sync'
import { escapeHtml, notifyRecipients, resolveCompanyRecipients } from '@/lib/company-notify'
import { loadCompanyStages } from '@/lib/deals/stage-store'
import { approvalTargetStage, DEFAULT_STAGES, type DealStageDef } from '@/lib/deals/stages'

/** The aluminium key of the "signed" column (kept for existing callers and tests). */
export const OFFER_APPROVED_STAGE = 'offer_approved'

const QUICK_OFFER_SOURCES = new Set(['quick_offer', 'quick_offer_saved'])

export interface ApprovedOffer {
  id: string
  deal_id: string | null
  company_id: string
  offer_number: string | null
  final_price: number | string | null
  customer_name: string | null
}

export interface ApprovalContact {
  customerName: string
  customerPhone: string | null
}

export interface DealForApproval {
  id: string
  source: string | null
  stage: string | null
  price: number | string | null
  customer_phone: string | null
  confirmed_date: string | null
  created_by: string | null
}

/**
 * Column patch after the customer signs. Any deal still before the firm's
 * "signed" column moves to it (aluminium: "offer approved"); later stages are
 * never moved back. Quick-offer deals are also un-hidden onto the board.
 * Returns null when there is nothing to write.
 */
export function buildApprovalDealPatch(
  deal: DealForApproval,
  offer: Pick<ApprovedOffer, 'final_price'>,
  contact: ApprovalContact,
  nowIso: string,
  stages: readonly DealStageDef[] = DEFAULT_STAGES,
): Record<string, unknown> | null {
  const isQuickOffer = !!deal.source && QUICK_OFFER_SOURCES.has(deal.source)
  const patch: Record<string, unknown> = {}

  if (isQuickOffer) patch.source = 'quick_offer_saved'

  const targetStage = approvalTargetStage(deal.stage, stages)
  if (targetStage) patch.stage = targetStage

  if (isQuickOffer) {
    const existingPrice = Number(deal.price)
    const offerPrice = Number(offer.final_price)
    if (!(existingPrice > 0) && offerPrice > 0) patch.price = offerPrice

    if (!deal.customer_phone?.trim() && contact.customerPhone?.trim()) {
      patch.customer_phone = contact.customerPhone.trim()
    }
    if (!deal.confirmed_date) patch.confirmed_date = nowIso
  }

  return Object.keys(patch).length > 0 ? patch : null
}

function formatShekel(value: number | string | null): string {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `₪${n.toLocaleString('he-IL')}` : '—'
}

export interface ApprovalMessageInput {
  offerLabel: string
  customerName: string
  customerPhone: string | null
  amount: number | string | null
  dealPromoted: boolean
  offerUrl: string
  boardUrl: string
}

export function buildApprovalEmail(input: ApprovalMessageInput): { subject: string; html: string } {
  const amount = formatShekel(input.amount)
  const rows: [string, string][] = [
    ['לקוח', input.customerName],
    ['טלפון', input.customerPhone?.trim() || '—'],
    ['מספר הצעה', input.offerLabel],
    ['סכום', amount],
  ]
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280">${escapeHtml(k)}</td><td style="padding:6px 12px;font-weight:bold">${escapeHtml(v)}</td></tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#f5f5f5">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
    <h2 style="margin:0 0 12px;color:#047857">הצעת מחיר אושרה ✔</h2>
    <p style="margin:0 0 16px;color:#374151">${escapeHtml(input.customerName)} חתם/ה על הצעת המחיר.</p>
    <table style="border-collapse:collapse;margin-bottom:20px">${rowsHtml}</table>
    ${
      input.dealPromoted
        ? '<p style="color:#374151">העסקה הועברה אוטומטית ללוח ה-CRM בשלב "הצעת מחיר מאושרת".</p>'
        : ''
    }
    <p>
      <a href="${escapeHtml(input.boardUrl)}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">פתח את ה-CRM</a>
      &nbsp;
      <a href="${escapeHtml(input.offerUrl)}" style="color:#2563eb">צפייה בהצעה</a>
    </p>
  </div>
</body></html>`

  return {
    subject: `הצעה אושרה: ${input.customerName} — ${amount}`,
    html,
  }
}

export interface ApprovalOutcome {
  dealPromoted: boolean
  emailsSent: number
  whatsappSent: boolean
}

export async function handleOfferApproved(
  supabase: SupabaseClient,
  offer: ApprovedOffer,
  contact: ApprovalContact,
): Promise<ApprovalOutcome> {
  const outcome: ApprovalOutcome = { dealPromoted: false, emailsSent: 0, whatsappSent: false }
  let creatorId: string | null = null

  if (offer.deal_id) {
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, source, stage, price, customer_phone, confirmed_date, created_by')
      .eq('id', offer.deal_id)
      .maybeSingle()

    if (dealError) {
      console.error('[offer-approval] deal lookup failed:', offer.deal_id, dealError)
    } else if (deal) {
      const d = deal as DealForApproval
      creatorId = d.created_by
      const { stages } = await loadCompanyStages(supabase, offer.company_id)
      const patch = buildApprovalDealPatch(d, offer, contact, new Date().toISOString(), stages)
      if (patch) {
        const { data: updated, error: updateError } = await supabase
          .from('deals')
          .update(patch)
          .eq('id', d.id)
          .select('id')
        if (updateError || !updated || updated.length === 0) {
          console.error('[offer-approval] deal promotion failed:', d.id, updateError ?? 'no rows updated')
        } else {
          outcome.dealPromoted = true
        }
      }
    }

    // A signed offer takes priority for the deal amount over the other offers.
    await trySyncDealPrice(supabase, {
      dealId: offer.deal_id,
      companyId: offer.company_id,
      context: `approval of offer ${offer.id}`,
    })
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const message: ApprovalMessageInput = {
    offerLabel: offer.offer_number?.trim() || offer.id.slice(0, 8),
    customerName: contact.customerName,
    customerPhone: contact.customerPhone,
    amount: offer.final_price,
    dealPromoted: outcome.dealPromoted,
    offerUrl: `${siteUrl}/he/offers/${offer.id}/approve`,
    boardUrl: `${appUrl}/app`,
  }

  const recipients = await resolveCompanyRecipients(supabase, offer.company_id, [creatorId])
  const { subject, html } = buildApprovalEmail(message)
  // WhatsApp template body params, in order: customer name, offer number, amount.
  const sent = await notifyRecipients(
    recipients,
    {
      subject,
      html,
      whatsappTemplateEnv: 'WHATSAPP_APPROVAL_TEMPLATE_NAME',
      whatsappParams: [message.customerName, message.offerLabel, formatShekel(message.amount)],
    },
    '[offer-approval]',
  )
  outcome.emailsSent = sent.emailsSent
  outcome.whatsappSent = sent.whatsappSent

  return outcome
}
