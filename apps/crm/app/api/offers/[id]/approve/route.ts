import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleOfferApproved } from '@/lib/offer-approval'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// POST - Approve offer with signature
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { signatureImage, customerName, customerPhone } = body

    if (!signatureImage || !customerName) {
      return NextResponse.json(
        { error: 'Signature and customer name are required' },
        { status: 400 }
      )
    }

    // Read the state before signing: the deal promotion and notifications must
    // fire once, on the transition to approved, not on every re-submit.
    const { data: before, error: beforeError } = await supabase
      .from('offers')
      .select('id, approved')
      .eq('id', params.id)
      .maybeSingle()

    if (beforeError) {
      console.error('Error loading offer before approval:', beforeError)
      return NextResponse.json(
        { error: 'Failed to approve offer', details: beforeError.message },
        { status: 500 }
      )
    }
    if (!before) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }
    const wasAlreadyApproved = before.approved === true

    // Update offer with approval data
    const { data, error } = await supabase
      .from('offers')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
        signature_image: signatureImage,
        approval_customer_name: customerName,
        approval_customer_phone: customerPhone || null,
        // Force next PDF generation to include the digital signature
        pdf_url: null,
        pdf_created_at: null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error approving offer:', error)
      return NextResponse.json(
        { error: 'Failed to approve offer', details: error.message },
        { status: 500 }
      )
    }

    if (!wasAlreadyApproved) {
      // Best effort: the signature is saved, so nothing here may fail the request.
      try {
        const outcome = await handleOfferApproved(
          supabase,
          {
            id: data.id,
            deal_id: data.deal_id ?? null,
            company_id: data.company_id,
            offer_number: data.offer_number ?? null,
            final_price: data.final_price ?? null,
            customer_name: data.customer_name ?? null,
          },
          { customerName, customerPhone: customerPhone || null },
        )
        console.log('[offer-approval]', params.id, outcome)
      } catch (postApprovalError) {
        console.error('[offer-approval] post-approval step failed:', params.id, postApprovalError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ההצעה אושרה בהצלחה!',
      offer: {
        id: data.id,
        approved: data.approved,
        approvedAt: data.approved_at,
      },
    })
  } catch (error: unknown) {
    console.error('Error in POST /api/offers/[id]/approve:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
