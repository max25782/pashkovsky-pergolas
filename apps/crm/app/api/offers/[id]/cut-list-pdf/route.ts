import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { calculateCutList } from '@/lib/cut-list/calculate-cut-list'
import { renderCutListHtml } from '@/lib/cut-list/cut-list-html-template'
import { renderHtmlToPdfBuffer } from '@/lib/pdf/render-html-to-pdf'
import { fetchCompanyPdfLocale, mergeUiPdfLocale } from '@/lib/pdf/company-pdf-locale'
import type { Offer } from '@/types/offer'
import { transformOfferFromDbRow } from '@/lib/pdf/map-offer-db-row-for-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const offer = await fetchOffer(params.id)
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    const { data: row, error: compErr } = await supabase
      .from('offers')
      .select('company_id')
      .eq('id', params.id)
      .single()
    if (compErr || !row) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }
    const access = await requireCompanyAccess(req, row.company_id as string)
    if (!access.authorized) return access.error

    const { searchParams } = new URL(req.url)
    const companyLocale = await fetchCompanyPdfLocale(supabase, row.company_id as string)
    const locale = mergeUiPdfLocale(searchParams.get('locale'), companyLocale)
    const cutList = calculateCutList(offer)
    const html = renderCutListHtml(cutList, locale)
    const pdfBuffer = await renderHtmlToPdfBuffer(html)

    // Content-Disposition filename must be ASCII-only; use offer ID as safe fallback
    const filename = `cut-list_${offer.id}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[cut-list-pdf]', e)
    return NextResponse.json(
      { error: 'Failed to generate cut list PDF', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
