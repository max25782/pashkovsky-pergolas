import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { renderOfferHtml } from '@/lib/pdf/offer-html-template'
import { fetchCompanyPdfLocale } from '@/lib/pdf/company-pdf-locale'
import { transformOfferFromDbRow } from '@/lib/pdf/map-offer-db-row-for-pdf'
import { ApproveClient } from './ApproveClient'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function OfferApprovePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id } = await params

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })

  const { data, error } = await supabase.from('offers').select('*').eq('id', id).single()

  if (error || !data) {
    notFound()
  }

  const offer = transformOfferFromDbRow(data as Record<string, unknown>)

  const companyId = data.company_id as string | undefined
  const pdfLocale = companyId ? await fetchCompanyPdfLocale(supabase, companyId) : 'he'

  // Render the PDF HTML server-side (needs filesystem access for fonts/logo)
  // Omit the static signature section — the client component renders an interactive pad instead.
  const offerHtml = renderOfferHtml(offer, null, true, pdfLocale)

  return (
    <ApproveClient
      offerId={id}
      offerHtml={offerHtml}
      alreadyApproved={offer.approval.approved === true}
      approvedAt={offer.approval.approvedAt ?? null}
      defaultName={offer.customerName ?? ''}
      defaultPhone={offer.customerPhone ?? ''}
    />
  )
}
