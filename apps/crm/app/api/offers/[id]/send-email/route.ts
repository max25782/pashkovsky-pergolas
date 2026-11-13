import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, generateOfferEmailHTML } from '@/lib/email'
import { isOfferPricingSnapshot, snapshotShareLines } from '@/lib/offers/offer-pricing-snapshot'
import { createClient } from '@supabase/supabase-js'
import { requirePermissionAsync } from '@/lib/middleware/auth'

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Session + offers:edit (owner/admin/manager/salesperson). The offer must belong to the caller's firm.
    const permission = await requirePermissionAsync(req, 'offers:edit')
    if (!permission.authorized) return permission.error as NextResponse
    const companyId = permission.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'Unauthorized: No company context' }, { status: 401 })
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const offerId = params.id
    if (!offerId) {
      return NextResponse.json({ error: 'Missing offer id' }, { status: 400 })
    }

    // Ownership first: nothing is sent until the offer is known to belong to this firm.
    const { data: offerData, error: offerError } = await supabase
      .from('offers')
      .select('id, company_id, options_notes, final_price, discount_percent, quick_offer_extra')
      .eq('id', offerId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (offerError) {
      console.error('Error loading offer for send-email:', offerError)
      return NextResponse.json({ error: 'Failed to load offer' }, { status: 500 })
    }
    if (!offerData) {
      // Same answer for "missing" and "other firm": do not leak existence across tenants.
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    const body = await req.json()
    const { email, offerUrl, customerName } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000'
    
    const defaultLocale = 'he'
    const finalOfferUrl = offerUrl || `${baseUrl}/${defaultLocale}/offers/${offerId}/approve`

    let aiText: string | null = null
    let saved: {
      finalPrice: number
      discountPercent: number
      lines?: { label: string; amount: number }[]
    } | null = null

    if (offerData.options_notes) {
      aiText = offerData.options_notes
    }
    const extra = offerData.quick_offer_extra as { pricingSnapshot?: unknown } | null
    const snapshot = extra?.pricingSnapshot
    if (isOfferPricingSnapshot(snapshot) && snapshot.totals.finalPrice != null) {
      saved = {
        finalPrice: Number(snapshot.totals.finalPrice),
        discountPercent: Number(snapshot.discountPercent) || 0,
        lines: snapshotShareLines(snapshot),
      }
    } else if (offerData.final_price != null) {
      saved = {
        finalPrice: Number(offerData.final_price),
        discountPercent: Number(offerData.discount_percent) || 0,
      }
    }

    const html = generateOfferEmailHTML(finalOfferUrl, customerName || 'לקוח יקר', aiText, saved)

    await sendEmail({
      to: email,
      subject: 'הצעת מחיר - Pashkovsky Group',
      html,
    })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    })
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('Email configuration is missing')) {
      return NextResponse.json(
        { 
          error: 'Email not configured',
          details: 'Please configure EMAIL_USER and EMAIL_PASS in environment variables'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: msg 
      },
      { status: 500 }
    )
  }
}
