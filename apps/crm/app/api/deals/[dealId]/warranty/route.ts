import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { getCompanyBranding, getDealById } from '@/lib/deals/get-deal-by-id'
import { buildWarrantyPdfSections, resolveProductLinesForPdf } from '@/lib/deals/deal-product-lines'
import { buildWarrantyPdfHtml } from '@/lib/pdf/warranty-html-template'
import { renderHtmlToPdfBuffer } from '@/lib/pdf/render-html-to-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

function todayHebrew(): string {
  return new Date().toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatInstallLabel(iso: string | null): string {
  if (!iso) return todayHebrew()
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return todayHebrew()
  return d.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildDescription(row: {
  notes: string | null
  work_type: string | null
  project_type: string | null
}): string {
  const parts: string[] = []
  if (row.work_type) parts.push(`סוג עבודה: ${row.work_type}`)
  if (row.project_type) parts.push(`סוג פרויקט: ${row.project_type}`)
  if (row.notes?.trim()) parts.push(row.notes.trim())
  const combined = parts.join('\n').trim()
  return combined !== '' ? combined : '—'
}

function addressLine(row: { project_address: string | null; customer_city: string | null }): string {
  const a = [row.project_address?.trim(), row.customer_city?.trim()].filter(Boolean).join(', ')
  return a !== '' ? a : '—'
}

function logoFromSettings(settings: Record<string, unknown> | null): string | undefined {
  if (!settings) return undefined
  const logo =
    typeof settings.logo_url === 'string'
      ? settings.logo_url
      : typeof settings.logoUrl === 'string'
        ? settings.logoUrl
        : undefined
  return logo?.trim() || undefined
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  const auth = await requireAuthAsync(_req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { dealId } = await context.params
  const { deal, error: fetchErr } = await getDealById(supabase, dealId)
  if (fetchErr || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  const access = await requireCompanyAccess(_req, deal.company_id)
  if (!access.authorized) return access.error

  const branding = await getCompanyBranding(supabase, deal.company_id)
  const companyName = branding?.name ?? 'Company'
  const logoUrl = logoFromSettings(branding?.settings ?? null)
  /** Optional full URL override for watermark-free PDF logo */
  const publicLogo =
    process.env.WARRANTY_PDF_LOGO_URL?.trim() || process.env.NEXT_PUBLIC_COMPANY_LOGO_URL?.trim() || logoUrl

  const clientName = deal.customer_name?.trim() ? deal.customer_name : 'לקוח'
  const addr = addressLine(deal)
  const desc = buildDescription(deal)
  const priceFormatted =
    deal.price != null && !Number.isNaN(Number(deal.price))
      ? new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(Number(deal.price))
      : null

  const installLabel = formatInstallLabel(deal.installation_date)
  const productLines = resolveProductLinesForPdf(deal.project_config, deal.work_type)
  const warrantySections = buildWarrantyPdfSections(productLines)

  const footerLines = [
    process.env.WARRANTY_FOOTER_PHONE ?? '052-449-4848',
    process.env.WARRANTY_FOOTER_EMAIL ?? 'office@pashkovskygroup.com',
    process.env.WARRANTY_FOOTER_WEB ?? '',
  ].filter((line) => line.trim() !== '')

  const footer =
    footerLines.length > 0
      ? footerLines
      : [`${companyName} · אלומיניום ופתרונות הצללה · © ${new Date().getFullYear()}`]

  const html = buildWarrantyPdfHtml({
    companyName,
    logoUrl: publicLogo,
    clientName,
    address: addr,
    projectDescription: desc,
    priceFormatted,
    installationDateLabelHe: installLabel,
    warrantySections,
    footerLines: footer,
  })

  try {
    const pdf = await renderHtmlToPdfBuffer(html)

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="warranty.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[warranty PDF]', e)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
