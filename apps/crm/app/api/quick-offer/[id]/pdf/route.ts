/**
 * POST /api/quick-offer/[id]/pdf
 *
 * Generates a PDF for a quick offer and returns it as a binary stream.
 * Does NOT require S3 upload — streams directly to the client for immediate download.
 * This keeps the "Download PDF without saving to CRM" flow fast and self-contained.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { generateOfferPdf } from '@/lib/pdf/generate-offer-pdf'
import { fetchPdfLocaleForOffer, mergeUiPdfLocale } from '@/lib/pdf/company-pdf-locale'
import type { Offer } from '@/types/offer'
import { transformOfferFromDbRow } from '@/lib/pdf/map-offer-db-row-for-pdf'
import { OfferPdfTotalsMismatchError } from '@/lib/pdf/offer-pdf-totals'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

async function fetchOffer(id: string): Promise<Offer | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).single()
  if (error || !data) return null
  return transformOfferFromDbRow(data as Record<string, unknown>)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const offer = await fetchOffer(params.id)
    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const companyLocale = await fetchPdfLocaleForOffer(supabase, params.id)
    const pdfLocale = mergeUiPdfLocale(searchParams.get('locale'), companyLocale)
    const pdfBuffer = await generateOfferPdf(offer, pdfLocale)
    const filename = `offer_${offer.id}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    if (e instanceof OfferPdfTotalsMismatchError) {
      return NextResponse.json(
        {
          error: 'Offer totals do not match PDF line items',
          linesSubtotal: e.linesSubtotal,
          storedTotalBeforeVat: e.storedTotalBeforeVat,
        },
        { status: 400 },
      )
    }
    console.error('[quick-offer/pdf]', e)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
