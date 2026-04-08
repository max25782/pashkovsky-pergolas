/**
 * POST /api/quick-offer/[id]/save-to-crm
 *
 * Creates a real CRM deal and links it to the quick-offer offer.
 * Called when the user explicitly chooses to save the offer to the CRM
 * (via "Save to CRM", WhatsApp, or any other action that requires a deal).
 *
 * Body: { customerName, customerPhone?, customerCity? }
 * Returns: { dealId, offerId }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { id: offerId } = await params

  let body: { customerName: string; customerPhone?: string; customerCity?: string; dealId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { customerName, customerPhone, customerCity } = body
  if (!customerName?.trim()) {
    return NextResponse.json({ error: 'customerName is required' }, { status: 400 })
  }

  // Fetch the offer to get company_id (and check if a deal already exists)
  const { data: offerRow, error: offerFetchError } = await supabase
    .from('offers')
    .select('id, company_id, deal_id')
    .eq('id', offerId)
    .single()

  if (offerFetchError || !offerRow) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  }

  // If a deal was already created for this offer, just update it
  if (offerRow.deal_id) {
    const { error: updateError } = await supabase
      .from('deals')
      .update({
        customer_name: customerName.trim(),
        customer_phone: customerPhone?.trim() ?? '',
        customer_city: customerCity?.trim() ?? null,
        source: 'quick_offer_saved',
      })
      .eq('id', offerRow.deal_id)

    if (updateError) {
      console.error('[save-to-crm] deal update error:', updateError)
      return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
    }

    await supabase
      .from('offers')
      .update({
        customer_name: customerName.trim(),
        customer_phone: customerPhone?.trim() ?? null,
        customer_city: customerCity?.trim() ?? null,
      })
      .eq('id', offerId)

    return NextResponse.json({ dealId: offerRow.deal_id, offerId })
  }

  // No deal yet — create one now
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      company_id: offerRow.company_id,
      customer_name: customerName.trim(),
      customer_phone: customerPhone?.trim() ?? '',
      customer_city: customerCity?.trim() ?? null,
      deal_status: 'in_progress',
      work_type: 'pergola',
      source: 'quick_offer_saved',
      currency: 'ILS',
    })
    .select('id')
    .single()

  if (dealError || !deal) {
    console.error('[save-to-crm] deal insert error:', dealError)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }

  const dealId = deal.id as string

  // Link offer to the new deal and update customer info
  const { error: offerUpdateError } = await supabase
    .from('offers')
    .update({
      deal_id: dealId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone?.trim() ?? null,
      customer_city: customerCity?.trim() ?? null,
    })
    .eq('id', offerId)

  if (offerUpdateError) {
    console.error('[save-to-crm] offer update error:', offerUpdateError)
    // Deal was created — still return success, the link can be repaired
  }

  return NextResponse.json({ dealId, offerId })
}
